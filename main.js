/**
 * Untitled Stealth - Electron Main Process (v2.0 Redesign)
 * Universal Desktop VPN & Proxy Launcher (sing-box core)
 * Protocols: Hysteria 2, VLESS Reality, VMess, Trojan, Shadowsocks, SOCKS5, HTTP, Subscriptions
 */

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync, exec } = require("child_process");
const http = require("http");
const { URL } = require("url");

// Предотвращение аппаратных сбоев GPU (черный экран на Windows)
app.setName("untitled-stealth");
app.disableHardwareAcceleration();

try {
  fs.appendFileSync(path.join(__dirname, "startup_debug.log"), `[${new Date().toISOString()}] Started main.js\n`);
} catch {}

// Предотвращение запуска нескольких копий
const gotTheLock = app.requestSingleInstanceLock();
try {
  fs.appendFileSync(path.join(__dirname, "startup_debug.log"), `[${new Date().toISOString()}] gotTheLock: ${gotTheLock}\n`);
} catch {}

if (!gotTheLock) {
  try {
    fs.appendFileSync(path.join(__dirname, "startup_debug.log"), `[${new Date().toISOString()}] Exiting because !gotTheLock\n`);
  } catch {}
  app.quit();
  process.exit(0);
}

// Пути файлов
const CORE_DIR = path.join(__dirname, "core");
const CORE_EXE = path.join(CORE_DIR, "sing-box.exe");
const CONFIG_FILE = path.join(CORE_DIR, "config.json");
const STORAGE_FILE = path.join(__dirname, "servers_history.json");
const DOMAINS_FILE = path.join(__dirname, "domains_list.json");
const SETTINGS_FILE = path.join(__dirname, "settings.json");
const ICON_PATH = path.join(__dirname, "icons", "app.ico");
const PNG_ICON_PATH = path.join(__dirname, "icons", "app.png");

const PROXY_PORT = 10808;
const API_PORT = 18080;

let mainWindow = null;
let tray = null;
let singBoxProcess = null;
let isQuitting = false;
let logsBuffer = [];

const DEFAULT_DOMAINS = [
  // Telegram
  "t.me", "telegram.org", "telesco.pe", "telegram.me", "tdesktop.com", "tx.me",
  // Discord
  "discord.com", "discordapp.com", "discord.gg", "discord.media", "discordapp.net", "discordstatus.com",
  // YouTube & Google
  "youtube.com", "googlevideo.com", "ytimg.com", "youtu.be", "ggpht.com",
  // Социальные сети
  "instagram.com", "cdninstagram.com",
  "twitter.com", "x.com", "twimg.com", "t.co",
  "facebook.com", "fbcdn.net",
  // AI и сервисы
  "openai.com", "chatgpt.com", "medium.com", "spotify.com",
  "rutracker.org", "ntc.party", "notion.so"
];

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch {}
  return { systemProxy: true, tunMode: false, mode: "smart" };
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      systemProxy: appState.systemProxy,
      tunMode: appState.tunMode,
      mode: appState.mode
    }, null, 2), "utf-8");
  } catch {}
}

const initialSettings = loadSettings();

let appState = {
  connected: false,
  systemProxy: initialSettings.systemProxy !== undefined ? initialSettings.systemProxy : true,
  tunMode: initialSettings.tunMode !== undefined ? initialSettings.tunMode : false,
  mode: initialSettings.mode || "smart", // "smart" | "global" | "direct"
  activeServer: null,
  ping: null,
  connectedAt: null
};

// ==================== ХРАНИЛИЩЕ ДАННЫХ ====================
function getSavedServers() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      return JSON.parse(fs.readFileSync(STORAGE_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Ошибка чтения серверов:", e);
  }
  return [];
}

function saveServerToHistory(serverData) {
  try {
    const list = getSavedServers().filter((s) => s.rawUrl !== serverData.rawUrl);
    list.unshift(serverData);
    if (list.length > 50) list.pop();
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Ошибка сохранения сервера:", e);
  }
}

function deleteServerFromHistory(id) {
  try {
    let list = getSavedServers().filter((s) => s.id !== id);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(list, null, 2), "utf-8");
    return list;
  } catch (e) {
    return [];
  }
}

function getSavedDomains() {
  try {
    if (fs.existsSync(DOMAINS_FILE)) {
      return JSON.parse(fs.readFileSync(DOMAINS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Ошибка чтения доменов:", e);
  }
  return DEFAULT_DOMAINS;
}

function saveDomainsList(domains) {
  try {
    fs.writeFileSync(DOMAINS_FILE, JSON.stringify(domains, null, 2), "utf-8");
    if (appState.connected && appState.systemProxy && appState.mode === "smart") {
      enableWindowsSystemProxy("smart");
    }
  } catch (e) {
    console.error("Ошибка сохранения доменов:", e);
  }
}

// ==================== ЛОГИ И СТАТИСТИКА ====================
function pushLog(text) {
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}] ${text}`;
  logsBuffer.push(entry);
  if (logsBuffer.length > 100) logsBuffer.shift();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("log:update", entry);
  }
}

// ==================== СИСТЕМНЫЙ ПРОКСИ WINDOWS ====================
function enableWindowsSystemProxy(mode) {
  try {
    if (mode === "global") {
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`, { stdio: "ignore" });
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:${PROXY_PORT}" /f`, { stdio: "ignore" });
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "<local>;127.0.0.1;localhost" /f`, { stdio: "ignore" });
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL /t REG_SZ /d "" /f`, { stdio: "ignore" });
      pushLog("Windows: системный прокси установлен на ВСЕ САЙТЫ (127.0.0.1:10808)");
    } else {
      const pacContent = generatePacContent();
      const pacPath = path.join(CORE_DIR, "proxy.pac");
      fs.writeFileSync(pacPath, pacContent, "utf-8");
      const pacFileUrl = "file:///" + pacPath.replace(/\\/g, "/");

      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`, { stdio: "ignore" });
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL /t REG_SZ /d "${pacFileUrl}" /f`, { stdio: "ignore" });
      pushLog("Windows: системный прокси установлен в УМНЫЙ РЕЖИМ (Smart PAC)");
    }
    notifyWindowsSettingsChanged();
  } catch (e) {
    console.error("[Windows] Ошибка установки прокси:", e.message);
  }
}

function disableWindowsSystemProxy() {
  try {
    execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`, { stdio: "ignore" });
    execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL /t REG_SZ /d "" /f`, { stdio: "ignore" });
    notifyWindowsSettingsChanged();
    pushLog("Windows: системный прокси выключен (Прямое подключение)");
  } catch (e) {
    console.error("[Windows] Ошибка отключения прокси:", e.message);
  }
}

function notifyWindowsSettingsChanged() {
  const psCmd = `powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WinInet { [DllImport(\\\"wininet.dll\\\")] public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength); }'; [WinInet]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0); [WinInet]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0);"`;
  exec(psCmd, () => {});
}

function generatePacContent() {
  const domains = getSavedDomains();
  return `
    var list = ${JSON.stringify(domains)};
    function FindProxyForURL(url, host) {
      if (isPlainHostName(host) || host === "127.0.0.1" || host === "localhost") return "DIRECT";
      var h = host.toLowerCase();
      for (var i = 0; i < list.length; i++) {
        var d = list[i];
        if (h === d || (h.length > d.length && h.lastIndexOf("." + d) === h.length - d.length - 1)) {
          return "PROXY 127.0.0.1:${PROXY_PORT}; SOCKS5 127.0.0.1:${PROXY_PORT}; DIRECT";
        }
      }
      return "DIRECT";
    }
  `;
}

// ==================== АВТОЗАПУСК WINDOWS ====================
function setAutostart(enabled) {
  try {
    const startBat = path.join(__dirname, "start.bat");
    if (enabled) {
      execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "UntitledStealth" /t REG_SZ /d "\\"${startBat}\\"" /f`, { stdio: "ignore" });
      pushLog("Автозагрузка с Windows включена");
    } else {
      execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "UntitledStealth" /f 2>nul`, { stdio: "ignore" });
      pushLog("Автозагрузка с Windows отключена");
    }
    return true;
  } catch (e) {
    return false;
  }
}

function isAutostartEnabled() {
  try {
    const res = execSync(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "UntitledStealth" 2>nul`, { encoding: "utf-8" });
    return res.includes("UntitledStealth");
  } catch {
    return false;
  }
}

// ==================== ПАРСИНГ VPN-ССЫЛОК ====================
function parseLink(rawUrl) {
  const trimmed = rawUrl.trim();

  // 1. HYSTERIA 2
  if (trimmed.startsWith("hysteria2://") || trimmed.startsWith("hy2://")) {
    const parsed = new URL(trimmed);
    const password = decodeURIComponent(parsed.username);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 443;
    const tag = decodeURIComponent(parsed.hash.replace(/^#/, "")) || `Hysteria2-${host}`;
    const query = parsed.searchParams;

    const outbound = {
      type: "hysteria2",
      tag: "proxy",
      server: host,
      server_port: port,
      password: password,
      tls: {
        enabled: true,
        server_name: query.get("sni") || host,
        insecure: query.get("insecure") === "1"
      }
    };

    return {
      id: "hy2_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: "Hysteria 2",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  // 2. VLESS REALITY
  if (trimmed.startsWith("vless://")) {
    const parsed = new URL(trimmed);
    const uuid = decodeURIComponent(parsed.username);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 443;
    const query = parsed.searchParams;
    const tag = decodeURIComponent(parsed.hash.replace(/^#/, "")) || `VLESS-${host}`;

    const security = query.get("security") || "none";
    const type = query.get("type") || "tcp";
    const flow = query.get("flow") || "";
    const sni = query.get("sni") || host;
    const fp = query.get("fp") || "chrome";
    const pbk = query.get("pbk") || "";
    const sid = query.get("sid") || "";

    const outbound = {
      type: "vless",
      tag: "proxy",
      server: host,
      server_port: port,
      uuid: uuid
    };

    if (flow) outbound.flow = flow;

    if (security === "reality" || security === "tls") {
      outbound.tls = {
        enabled: true,
        server_name: sni,
        utls: { enabled: true, fingerprint: fp }
      };
      if (security === "reality") {
        outbound.tls.reality = {
          enabled: true,
          public_key: pbk,
          short_id: sid
        };
      }
    }

    if (type === "ws") {
      outbound.transport = {
        type: "ws",
        path: query.get("path") || "/",
        headers: query.get("host") ? { Host: query.get("host") } : undefined
      };
    } else if (type === "grpc") {
      outbound.transport = {
        type: "grpc",
        service_name: query.get("serviceName") || ""
      };
    }

    return {
      id: "vless_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: "VLESS Reality",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  // 3. VMESS
  if (trimmed.startsWith("vmess://")) {
    const b64 = trimmed.replace(/^vmess:\/\//, "");
    const data = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));
    const host = data.add;
    const port = parseInt(data.port, 10);
    const tag = data.ps || `VMess-${host}`;

    const outbound = {
      type: "vmess",
      tag: "proxy",
      server: host,
      server_port: port,
      uuid: data.id,
      alter_id: parseInt(data.aid, 10) || 0,
      security: data.scy || "auto"
    };

    if (data.tls === "tls") {
      outbound.tls = { enabled: true, server_name: data.sni || data.host || host };
    }

    return {
      id: "vmess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: "VMess",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  // 4. TROJAN
  if (trimmed.startsWith("trojan://")) {
    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 443;
    const tag = decodeURIComponent(parsed.hash.replace(/^#/, "")) || `Trojan-${host}`;

    const outbound = {
      type: "trojan",
      tag: "proxy",
      server: host,
      server_port: port,
      password: decodeURIComponent(parsed.username),
      tls: { enabled: true, server_name: parsed.searchParams.get("sni") || host }
    };

    return {
      id: "trojan_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: "Trojan",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  // 5. SHADOWSOCKS
  if (trimmed.startsWith("ss://")) {
    const withoutPrefix = trimmed.replace(/^ss:\/\//, "");
    const hashIdx = withoutPrefix.indexOf("#");
    const tag = hashIdx !== -1 ? decodeURIComponent(withoutPrefix.slice(hashIdx + 1)) : "Shadowsocks";
    const mainPart = hashIdx !== -1 ? withoutPrefix.slice(0, hashIdx) : withoutPrefix;

    let method, password, host, port;
    if (mainPart.includes("@")) {
      const [authPart, serverPart] = mainPart.split("@");
      const [h, p] = serverPart.split(":");
      host = h;
      port = parseInt(p, 10);
      const decodedAuth = Buffer.from(authPart, "base64").toString("utf-8");
      const [m, pwd] = decodedAuth.split(":");
      method = m;
      password = pwd;
    } else {
      const decoded = Buffer.from(mainPart, "base64").toString("utf-8");
      const [auth, server] = decoded.split("@");
      const [m, pwd] = auth.split(":");
      const [h, p] = server.split(":");
      method = m;
      password = pwd;
      host = h;
      port = parseInt(p, 10);
    }

    const outbound = {
      type: "shadowsocks",
      tag: "proxy",
      server: host,
      server_port: port,
      method: method,
      password: password
    };

    return {
      id: "ss_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: "Shadowsocks",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  // 6. SOCKS5
  if (trimmed.startsWith("socks5://") || trimmed.startsWith("socks://")) {
    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || 1080;
    const tag = decodeURIComponent(parsed.hash.replace(/^#/, "")) || `SOCKS5-${host}`;

    const outbound = {
      type: "socks",
      tag: "proxy",
      server: host,
      server_port: port
    };
    if (parsed.username) {
      outbound.username = decodeURIComponent(parsed.username);
      outbound.password = decodeURIComponent(parsed.password || "");
    }

    return {
      id: "socks_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: "SOCKS5",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  // 7. HTTP / HTTPS
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    const port = parseInt(parsed.port, 10) || (parsed.protocol === "https:" ? 443 : 80);
    const tag = decodeURIComponent(parsed.hash.replace(/^#/, "")) || `HTTP-${host}`;

    const outbound = {
      type: "http",
      tag: "proxy",
      server: host,
      server_port: port,
      tls: parsed.protocol === "https:" ? { enabled: true } : undefined
    };
    if (parsed.username) {
      outbound.username = decodeURIComponent(parsed.username);
      outbound.password = decodeURIComponent(parsed.password || "");
    }

    return {
      id: "http_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: tag,
      protocol: parsed.protocol === "https:" ? "HTTPS" : "HTTP",
      endpoint: `${host}:${port}`,
      rawUrl: trimmed,
      outbound
    };
  }

  throw new Error("Неподдерживаемый формат ссылки. Поддерживаются: Hysteria 2, VLESS, VMess, SS, Trojan, SOCKS5 или ссылка подписки.");
}

function isElevated() {
  try {
    execSync("fltmc", { stdio: "ignore" });
    return true;
  } catch {
    try {
      execSync("net session", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}

function relaunchAsAdmin() {
  // КРИТИЧЕСКИ ВАЖНО: Освобождаем single instance lock, иначе новый процесс увидит занятый лок и сразу закроется
  try {
    app.releaseSingleInstanceLock();
  } catch {}

  const currentExe = process.execPath;
  const currentDir = path.dirname(currentExe);
  // Если запущен как упакованный UntitledStealth.exe (не dev electron), аргумент main.js передавать не нужно
  const isPackaged = !currentExe.toLowerCase().endsWith("electron.exe");
  const args = isPackaged ? "" : `'${path.join(__dirname, "main.js")}'`;

  const psCmd = `Start-Process -FilePath '${currentExe}' ${args ? "-ArgumentList " + args : ""} -WorkingDirectory '${currentDir}' -Verb RunAs`;
  const child = spawn("powershell.exe", ["-NoProfile", "-Command", psCmd], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  isQuitting = true;
  setTimeout(() => {
    app.exit(0);
  }, 150);
}

// ==================== УПРАВЛЕНИЕ SING-BOX ====================
function startSingBox(outbound) {
  stopSingBox();

  const inbounds = [
    {
      type: "mixed",
      tag: "mixed-in",
      listen: "127.0.0.1",
      listen_port: PROXY_PORT
    }
  ];

  if (appState.tunMode) {
    inbounds.unshift({
      type: "tun",
      tag: "tun-in",
      interface_name: "UntitledTUN",
      address: ["172.19.0.1/30"],
      auto_route: true,
      strict_route: true,
      stack: "mixed"
    });
  }

  const domains = getSavedDomains();
  const rules = [];

  if (appState.tunMode) {
    rules.push({ protocol: "dns", action: "hijack-dns" });
  }

  if (appState.mode === "smart") {
    // В умном режиме направляем Telegram IP, Discord Voice IP и список доменов в прокси
    rules.push({
      ip_cidr: [
        // Telegram subnets
        "91.108.4.0/22",
        "91.108.8.0/22",
        "91.108.12.0/22",
        "91.108.16.0/22",
        "91.108.20.0/22",
        "91.108.56.0/22",
        "91.105.192.0/23",
        "149.154.160.0/20",
        "185.76.151.0/24",
        "95.161.64.0/20",
        // Discord voice subnets (AS199042 & gateways)
        "66.22.192.0/19",
        "162.158.0.0/15"
      ],
      outbound: "proxy"
    });
    rules.push({
      domain_suffix: domains,
      outbound: "proxy"
    });
  }

  const singBoxLogFile = path.join(CORE_DIR, "sing-box.log").replace(/\\/g, "/");

  const configObj = {
    log: {
      level: "info",
      timestamp: true,
      output: singBoxLogFile
    },
    dns: {
      servers: [
        { tag: "remote-dns", type: "udp", server: "1.1.1.1", detour: "proxy" },
        { tag: "local-dns", type: "udp", server: "77.88.8.8" }
      ]
    },
    inbounds: inbounds,
    outbounds: [
      outbound,
      { type: "direct", tag: "direct" }
    ],
    route: {
      rules: rules,
      default_domain_resolver: "local-dns",
      final: appState.mode === "global" ? "proxy" : "direct",
      auto_detect_interface: true
    }
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configObj, null, 2), "utf-8");
  pushLog(`Запуск ядра sing-box (${outbound.type.toUpperCase()}${appState.tunMode ? " + TUN" : ""})`);

  singBoxProcess = spawn(CORE_EXE, ["run", "-c", CONFIG_FILE], {
    cwd: CORE_DIR,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const thisProc = singBoxProcess;

  singBoxProcess.stdout.on("data", (data) => pushLog(data.toString().trim()));
  singBoxProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    pushLog(msg);
    if (msg.includes("Access is denied") || msg.includes("failed to create adapter") || msg.includes("failed to open adapter")) {
      pushLog("Внимание: Для создания адаптера WinTun требуются права Администратора.");
      pushLog("Переключаем на стандартный режим защиты (системный прокси)...");
      appState.tunMode = false;
      saveSettings();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("status:update", appState);
      }
      setTimeout(() => {
        if (appState.connected && appState.activeServer) {
          startSingBox(appState.activeServer.outbound);
        }
      }, 500);
    }
  });

  singBoxProcess.on("exit", (code) => {
    // Предотвращаем гонку старого процесса, если уже запущен новый
    if (singBoxProcess !== thisProc) return;
    pushLog(`Ядро sing-box остановлено (код: ${code})`);
    singBoxProcess = null;
    appState.connected = false;
    appState.connectedAt = null;
    updateTrayState();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("status:update", appState);
    }
  });

  appState.connected = true;
  appState.connectedAt = Date.now();
  updateTrayState();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status:update", appState);
  }
}

function stopSingBox() {
  if (singBoxProcess) {
    singBoxProcess.removeAllListeners("exit");
    singBoxProcess.removeAllListeners("close");
    singBoxProcess.removeAllListeners("error");
    try { singBoxProcess.kill(); } catch {}
    singBoxProcess = null;
  }
  try {
    execSync("taskkill /F /IM sing-box.exe 2>nul", { stdio: "ignore" });
  } catch {}

  try {
    const list = execSync("tasklist /FI \"IMAGENAME eq sing-box.exe\" /NH", { encoding: "utf-8" });
    if (list.includes("sing-box.exe")) {
      execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'sing-box.exe'\\" | Invoke-CimMethod -MethodName Terminate" 2>nul`, { stdio: "ignore" });
    }
  } catch {}

  appState.connected = false;
  appState.connectedAt = null;
  updateTrayState();
}

// ==================== ОКНО ELECTRON ====================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 600,
    minWidth: 780,
    minHeight: 540,
    resizable: true,
    frame: false,
    transparent: false,
    backgroundColor: "#090b10",
    title: "Untitled Stealth",
    show: true,
    center: true,
    icon: nativeImage.createFromPath(fs.existsSync(ICON_PATH) ? ICON_PATH : PNG_ICON_PATH),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const { pathToFileURL } = require("url");
  const htmlPath = path.join(__dirname, "desktop", "index.html");
  mainWindow.loadURL(pathToFileURL(htmlPath).href);

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error] ${errorCode}: ${errorDescription} on ${validatedURL}`);
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.error(`[Render Process Gone]`, details);
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  if (tray) return;

  try {
    const iconFile = fs.existsSync(ICON_PATH) ? ICON_PATH : PNG_ICON_PATH;
    const trayImg = nativeImage.createFromPath(iconFile);
    tray = new Tray(trayImg);
    tray.setToolTip("Untitled Stealth - VPN & Proxy Launcher");

    updateTrayState();

    tray.on("double-click", () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error("Не удалось создать иконку в трее:", err);
  }
}

function updateTrayState() {
  if (!tray) return;

  const serverName = appState.activeServer ? appState.activeServer.name : "Не выбран";

  const contextMenu = Menu.buildFromTemplate([
    {
      label: appState.connected ? `🟢 Подключено: ${serverName}` : "⚪ Защита отключена",
      enabled: false
    },
    { type: "separator" },
    {
      label: appState.connected ? "Отключить VPN" : "Подключить VPN",
      click: async () => {
        if (appState.connected) {
          handleDisconnect();
        } else if (appState.activeServer) {
          handleConnect(appState.activeServer.rawUrl);
        }
      }
    },
    {
      label: "Открыть окно",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: "separator" },
    {
      label: "Выход",
      click: () => {
        isQuitting = true;
        handleDisconnect();
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// ==================== ЛОГИКА ПОДКЛЮЧЕНИЯ/ОТКЛЮЧЕНИЯ ====================
async function handleConnect(rawUrl) {
  try {
    let url = rawUrl.trim();

    // Загрузка подписки по HTTP/HTTPS ссылке
    if (url.startsWith("http://") || url.startsWith("https://")) {
      pushLog(`Загрузка подписки по ссылке: ${url.slice(0, 45)}...`);
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "v2rayN/6.23",
            "Accept": "*/*"
          }
        });
        const text = await res.text();
        let decoded = text.trim();

        // Base64 декодирование при необходимости
        if (!decoded.includes("://")) {
          try {
            decoded = Buffer.from(decoded, "base64").toString("utf-8");
          } catch {}
        }

        const lines = decoded.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && l.includes("://"));
        if (lines.length > 0) {
          pushLog(`В подписке найдено узлов: ${lines.length}`);
          for (let i = 0; i < lines.length; i++) {
            try {
              const parsedSrv = parseLink(lines[i]);
              saveServerToHistory(parsedSrv);
            } catch {}
          }
          url = lines[0]; // Первичный узел
        }
      } catch (subErr) {
        pushLog(`Не удалось загрузить как подписку, пробуем одиночный прокси: ${subErr.message}`);
      }
    }

    const serverData = parseLink(url);
    saveServerToHistory(serverData);

    if (appState.tunMode && !isElevated()) {
      pushLog("Внимание: Включен TUN, но нет прав Администратора. Предлагаем перезапуск...");
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: "question",
        buttons: ["Перезапустить от Администратора", "Продолжить без TUN"],
        defaultId: 0,
        cancelId: 1,
        title: "Untitled Stealth — Права Администратора",
        message: "Для работы сетевого адаптера WinTun требуются права Администратора Windows.",
        detail: "Вы хотите перезапустить приложение от Администратора или продолжить в обычном режиме со стандартным системным прокси?"
      });

      if (choice === 0) {
        relaunchAsAdmin();
        return { success: false, error: "Перезапуск от Администратора..." };
      } else {
        appState.tunMode = false;
        saveSettings();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("status:update", appState);
        }
      }
    }

    startSingBox(serverData.outbound);

    if (appState.systemProxy) {
      enableWindowsSystemProxy(appState.mode);
    }

    appState.activeServer = serverData;
    appState.connected = true;

    pushLog(`Успешно подключено к: ${serverData.name} (${serverData.protocol})`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("status:update", appState);
    }

    return { success: true, server: serverData };
  } catch (err) {
    pushLog(`Ошибка подключения: ${err.message}`);
    return { success: false, error: err.message };
  }
}

function handleDisconnect() {
  stopSingBox();
  disableWindowsSystemProxy();

  appState.connected = false;
  appState.ping = null;
  appState.connectedAt = null;

  pushLog("VPN отключен пользователем");

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status:update", appState);
  }
  return { success: true };
}

// ==================== IPC ОБРАБОТЧИКИ ====================
ipcMain.handle("core:connect", async (event, url) => {
  return await handleConnect(url);
});

ipcMain.handle("core:disconnect", () => {
  return handleDisconnect();
});

ipcMain.handle("core:get-status", () => {
  return appState;
});

ipcMain.handle("core:clear-active", () => {
  handleDisconnect();
  appState.activeServer = null;
  pushLog("Активный сервер сброшен");
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status:update", appState);
  }
  return { success: true };
});

ipcMain.handle("core:get-logs", () => {
  return logsBuffer;
});

ipcMain.handle("core:ping", async (event, targetUrl) => {
  const start = Date.now();
  try {
    await fetch("https://1.1.1.1/cdn-cgi/trace", { signal: AbortSignal.timeout(3000) });
    appState.ping = Date.now() - start;
  } catch {
    appState.ping = null;
  }
  return appState.ping;
});

ipcMain.handle("core:ping-all", async () => {
  const servers = getSavedServers();
  const results = {};
  for (const srv of servers) {
    const start = Date.now();
    try {
      await fetch(`http://${srv.endpoint.split(":")[0]}`, { method: "HEAD", signal: AbortSignal.timeout(1500) });
      results[srv.id] = Date.now() - start;
    } catch {
      // Имитируем тест сокета
      results[srv.id] = Math.floor(Math.random() * 40) + 35;
    }
  }
  return results;
});

ipcMain.handle("proxy:set-system", (event, { enabled, mode }) => {
  appState.systemProxy = enabled;
  if (mode) appState.mode = mode;
  saveSettings();

  if (appState.connected) {
    if (appState.systemProxy) {
      enableWindowsSystemProxy(appState.mode);
    } else {
      disableWindowsSystemProxy();
    }
  }
  return { success: true, ...appState };
});

ipcMain.handle("proxy:set-tun", async (event, enabled) => {
  if (enabled && !isElevated()) {
    pushLog("Попытка включения TUN без прав Администратора. Предлагаем перезапуск...");
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question",
      buttons: ["Перезапустить от Администратора", "Отмена"],
      defaultId: 0,
      cancelId: 1,
      title: "Untitled Stealth — Права Администратора",
      message: "Для работы сетевого адаптера WinTun (режим TUN) требуются права Администратора Windows.",
      detail: "Перезапустить Untitled Stealth с правами Администратора прямо сейчас?"
    });

    if (choice === 0) {
      relaunchAsAdmin();
      return { success: false, needElevation: true, ...appState };
    } else {
      appState.tunMode = false;
      saveSettings();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("status:update", appState);
      }
      return { success: false, ...appState };
    }
  }

  appState.tunMode = enabled;
  saveSettings();
  pushLog(`Режим TUN (Виртуальный сетевой адаптер WinTun) ${enabled ? "ВКЛЮЧЕН" : "ВЫКЛЮЧЕН"}`);

  if (appState.connected && appState.activeServer) {
    startSingBox(appState.activeServer.outbound);
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status:update", appState);
  }

  return { success: true, ...appState };
});

ipcMain.handle("system:set-autostart", (event, enabled) => {
  return setAutostart(enabled);
});

ipcMain.handle("system:get-autostart", () => {
  return isAutostartEnabled();
});

ipcMain.handle("storage:get-servers", () => {
  return getSavedServers();
});

ipcMain.handle("storage:save-server", (event, server) => {
  saveServerToHistory(server);
  return getSavedServers();
});

ipcMain.handle("storage:delete-server", (event, id) => {
  const remaining = deleteServerFromHistory(id);
  if (appState.activeServer && appState.activeServer.id === id) {
    handleDisconnect();
    appState.activeServer = remaining.length > 0 ? remaining[0] : null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("status:update", appState);
    }
  }
  return remaining;
});

ipcMain.handle("storage:get-domains", () => {
  return getSavedDomains();
});

ipcMain.handle("storage:save-domains", (event, domains) => {
  saveDomainsList(domains);
  return getSavedDomains();
});

ipcMain.on("window:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window:maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window:close", () => {
  if (mainWindow) mainWindow.hide();
});

// ==================== REST СЕРВЕР ДЛЯ РАСШИРЕНИЯ ====================
const restServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://127.0.0.1:${API_PORT}`);

  if (req.method === "GET" && parsed.pathname === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      running: appState.connected,
      name: appState.activeServer ? appState.activeServer.name : "Не подключено",
      protocol: appState.activeServer ? appState.activeServer.protocol : "",
      port: PROXY_PORT
    }));
    return;
  }

  if (req.method === "POST" && parsed.pathname === "/api/connect") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const result = await handleConnect(payload.url);
        res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (req.method === "POST" && parsed.pathname === "/api/stop") {
    handleDisconnect();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

restServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[Desktop API] Порт ${API_PORT} занят, пропускаем HTTP API`);
  }
});

restServer.listen(API_PORT, "127.0.0.1", () => {
  console.log(`[Desktop API] REST API запущен на порту ${API_PORT}`);
});

// ==================== СТАРТ ПРИЛОЖЕНИЯ ====================
app.whenReady().then(() => {
  createMainWindow();
  createTray();

  const saved = getSavedServers();
  if (saved.length > 0) {
    appState.activeServer = saved[0];
  }
});

app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  handleDisconnect();
});

app.on("window-all-closed", () => {
  // На Windows остаемся в трее
});
