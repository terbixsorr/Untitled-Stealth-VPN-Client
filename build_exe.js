const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("=== СБОРКА АВТОНОМНОГО SINGLE EXE ДЛЯ UNTITLED STEALTH ===");

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, "dist");
const TEMP_BUILD = path.join(ROOT_DIR, "temp_build");
const TEMP_ZIP = path.join(ROOT_DIR, "temp_app.zip");
const STUB_EXE = path.join(ROOT_DIR, "launcher_stub.exe");
const TARGET_EXE = path.join(DIST_DIR, "UntitledStealth-v1.0.0.exe");
const ICON_PATH = path.join(ROOT_DIR, "icons", "app.ico");
const ELECTRON_DIST = path.join(ROOT_DIR, "node_modules", "electron", "dist");

// 1. Очистка и создание директорий
if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
if (fs.existsSync(TEMP_BUILD)) fs.rmSync(TEMP_BUILD, { recursive: true, force: true });
if (fs.existsSync(TEMP_ZIP)) fs.unlinkSync(TEMP_ZIP);
fs.mkdirSync(TEMP_BUILD, { recursive: true });

function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.name === ".git" || entry.name.endsWith(".log") || entry.name.startsWith("test_") || entry.name.endsWith(".zip")) {
      continue;
    }

    if (entry.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Копируем исполняемую среду Electron в корень пакета (нативная структура Electron)
console.log("1. Копирование библиотек Electron и ffmpeg.dll...");
const electronEntries = fs.readdirSync(ELECTRON_DIST, { withFileTypes: true });
for (const entry of electronEntries) {
  const srcPath = path.join(ELECTRON_DIST, entry.name);
  if (entry.name.toLowerCase() === "electron.exe") {
    // Переименовываем electron.exe в UntitledStealth.exe
    fs.copyFileSync(srcPath, path.join(TEMP_BUILD, "UntitledStealth.exe"));
  } else if (entry.isDirectory()) {
    copyFolderRecursive(srcPath, path.join(TEMP_BUILD, entry.name));
  } else {
    fs.copyFileSync(srcPath, path.join(TEMP_BUILD, entry.name));
  }
}

// 3. Копируем исходники приложения в resources/app
console.log("2. Упаковка кода приложения в resources/app...");
const appDir = path.join(TEMP_BUILD, "resources", "app");
fs.mkdirSync(appDir, { recursive: true });

copyFolderRecursive(path.join(ROOT_DIR, "core"), path.join(appDir, "core"));
copyFolderRecursive(path.join(ROOT_DIR, "desktop"), path.join(appDir, "desktop"));
copyFolderRecursive(path.join(ROOT_DIR, "icons"), path.join(appDir, "icons"));
copyFolderRecursive(path.join(ROOT_DIR, "options"), path.join(appDir, "options"));
copyFolderRecursive(path.join(ROOT_DIR, "popup"), path.join(appDir, "popup"));

const appFiles = [
  "background.js",
  "domains_list.json",
  "main.js",
  "manifest.json",
  "package.json",
  "preload.js",
  "server.js",
  "settings.json"
];

for (const f of appFiles) {
  const p = path.join(ROOT_DIR, f);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(appDir, f));
  }
}

// 4. Сжатие в ZIP
console.log("3. Сжатие пакета в архив...");
const psZipCmd = `[System.IO.Compression.ZipFile]::CreateFromDirectory('${TEMP_BUILD}', '${TEMP_ZIP}', [System.IO.Compression.CompressionLevel]::Optimal, $false)`;
execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; ${psZipCmd}"`);

const zipStats = fs.statSync(TEMP_ZIP);
console.log(`Размер сжатого архива: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB`);

// 5. Компиляция C# лаунчера
console.log("4. Компиляция C# лаунчера...");
const cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
const cscCmd = `"${cscPath}" /target:winexe /out:"${STUB_EXE}" /win32icon:"${ICON_PATH}" /reference:System.Windows.Forms.dll,System.Drawing.dll,System.IO.Compression.dll,System.IO.Compression.FileSystem.dll,Microsoft.CSharp.dll "${path.join(ROOT_DIR, "StandaloneLauncher.cs")}"`;
execSync(cscCmd, { stdio: "inherit" });

// 6. Объединение stub.exe + zip + zipLength (8 bytes long)
console.log("5. Создание финального исполняемого файла...");
const stubBytes = fs.readFileSync(STUB_EXE);
const zipBytes = fs.readFileSync(TEMP_ZIP);

const lenBuf = Buffer.alloc(8);
lenBuf.writeBigInt64LE(BigInt(zipBytes.length), 0);

const outStream = fs.createWriteStream(TARGET_EXE);
outStream.write(stubBytes);
outStream.write(zipBytes);
outStream.write(lenBuf);
outStream.end();

outStream.on("finish", () => {
  const exeStats = fs.statSync(TARGET_EXE);
  console.log(`\n🎉 СБОРКА УСПЕШНО ЗАВЕРШЕНА!`);
  console.log(`Файл: ${TARGET_EXE}`);
  console.log(`Итоговый размер EXE: ${(exeStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Очистка временных файлов
  console.log("Очистка временных файлов...");
  try { fs.rmSync(TEMP_BUILD, { recursive: true, force: true }); } catch {}
  try { fs.unlinkSync(TEMP_ZIP); } catch {}
  try { fs.unlinkSync(STUB_EXE); } catch {}
  console.log("Готово!");
});
