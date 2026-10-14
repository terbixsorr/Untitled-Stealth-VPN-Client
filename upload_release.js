const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

async function main() {
  console.log("=== СОЗДАНИЕ РЕЛИЗА И ЗАГРУЗКА EXE НА GITHUB ===");

  const out = execSync("git credential fill", { input: "protocol=https\nhost=github.com\n\n" }).toString();
  const token = out.match(/password=(.+)/)[1].trim();

  const repo = "terbixsorr/Untitled-Stealth-VPN-Client";
  const exePath = path.join(__dirname, "dist", "UntitledStealth-v1.0.0.exe");

  if (!fs.existsSync(exePath)) {
    throw new Error("EXE файл не найден: " + exePath);
  }

  const exeSize = fs.statSync(exePath).size;
  console.log(`Размер EXE: ${(exeSize / 1024 / 1024).toFixed(2)} MB`);

  // 1. Получаем или создаем Release
  console.log("1. Проверка Release v1.0.0 на GitHub...");
  let relData = null;
  const getRelRes = await fetch(`https://api.github.com/repos/${repo}/releases/tags/v1.0.0`, {
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "NodeJS-ReleaseUploader"
    }
  });

  if (getRelRes.ok) {
    relData = await getRelRes.json();
    console.log(`Существующий релиз найден! ID: ${relData.id}`);

    // Если ассет уже есть — удаляем его перед повторной заливкой
    if (relData.assets && relData.assets.length > 0) {
      for (const asset of relData.assets) {
        if (asset.name === "UntitledStealth-v1.0.0.exe") {
          console.log(`Удаление старого ассета ${asset.name} (ID: ${asset.id})...`);
          await fetch(`https://api.github.com/repos/${repo}/releases/assets/${asset.id}`, {
            method: "DELETE",
            headers: {
              "Authorization": "token " + token,
              "Accept": "application/vnd.github.v3+json",
              "User-Agent": "NodeJS-ReleaseUploader"
            }
          });
          console.log("Старый ассет удален.");
        }
      }
    }
  } else {
    const releaseBody = {
      tag_name: "v1.0.0",
      target_commitish: "main",
      name: "Untitled Stealth v1.0.0 — Релиз автономного VPN-клиента",
      body: `## ⚡ Релиз Untitled Stealth v1.0.0

Первый стабильный релиз автономного десктопного VPN-клиента **Untitled Stealth** для Windows.

### 📦 Скачать готовый EXE:
- **[UntitledStealth-v1.0.0.exe](https://github.com/${repo}/releases/download/v1.0.0/UntitledStealth-v1.0.0.exe)** — единый переносимый файл (не требует установки Node.js или дополнительных библиотек).

### 🚀 Возможности и технологии:
- ⚡ **Ядро sing-box v1.14**: высочайшая производительность и минимальные задержки.
- 🛡 **Режим TUN (драйвер WinTun)**: полноценный захват трафика на уровне сетевой карты. Решает проблему голосовых каналов Discord, звонков Telegram и сетевых игр (Dota 2, CS2).
- 🚀 **Поддерживаемые протоколы**: Hysteria 2, VLESS Reality, VMess, Trojan, Shadowsocks, SOCKS5, HTTP и ссылки подписок.
- 🧠 **Умная маршрутизация (Smart PAC)**: автоматический пропуск заблокированных сервисов через VPN, а банков, Госуслуг и локальных сайтов — напрямую на максимальной скорости.
- 🌐 **Глобальный режим (Global)**: перенаправление всего системного трафика.
- 🪟 **Интеграция с Windows**: управление системным прокси в 1 клик, сворачивание в трей, автозапуск, поддержка ярлыков с правами Администратора.
- 📊 **Живая телеметрия**: пинг до сервера, графики и счетчики скорости скачивания и отдачи.
- 🎨 **Obsidian Cyberpunk UI**: современный темный интерфейс.
`,
      draft: false,
      prerelease: false
    };

    const relRes = await fetch(`https://api.github.com/repos/${repo}/releases`, {
      method: "POST",
      headers: {
        "Authorization": "token " + token,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "NodeJS-ReleaseUploader",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(releaseBody)
    });

    relData = await relRes.json();
    if (!relRes.ok) {
      console.error("Ошибка создания релиза:", relData);
      process.exit(1);
    }
    console.log(`Релиз успешно создан! ID: ${relData.id}`);
  }

  console.log(`URL релиза: ${relData.html_url}`);

  // 2. Загружаем EXE ассет
  const uploadUrlTemplate = relData.upload_url;
  const uploadUrl = uploadUrlTemplate.replace("{?name,label}", "?name=UntitledStealth-v1.0.0.exe");

  console.log("2. Загрузка EXE файла в ассеты релиза (это может занять около 30-60 сек)...");

  const fileBuffer = fs.readFileSync(exePath);

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": "token " + token,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "NodeJS-ReleaseUploader",
      "Content-Type": "application/octet-stream",
      "Content-Length": exeSize.toString()
    },
    body: fileBuffer
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    console.error("Ошибка загрузки ассета:", uploadData);
    process.exit(1);
  }

  console.log("\n🎉 EXE ФАЙЛ УСПЕШНО ЗАГРУЖЕН В GITHUB RELEASES!");
  console.log(`Ссылка на скачивание: ${uploadData.browser_download_url}`);
  console.log(`Страница релиза: ${relData.html_url}`);
}

main().catch(console.error);
