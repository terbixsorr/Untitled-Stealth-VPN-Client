/**
 * Untitled Stealth - Core Launcher Backend (Node.js)
 * Manages sing-box core, parses all VPN protocols (VLESS, VMess, Trojan, Shadowsocks, Hysteria2, SOCKS5, HTTP)
 * Provides local REST API on 127.0.0.1:18080 for the browser extension
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { URL } = require("url");

const PORT = 18080;
const PROXY_PORT = 10808;
const CORE_PATH = path.join(__dirname, "core", "sing-box.exe");
const CONFIG_PATH = path.join(__dirname, "core", "config.json");

let currentProcess = null;
let currentConfig = {
  running: false,
  rawUrl: "",
  name: "Не подключено",
  protocol: "",
  server: "",
  port: PROXY_PORT
};

// ==================== ПАРСИНГ VPN-ССЫЛОК ====================

function parseVpnUrl(rawUrl) {
  const trimmed = rawUrl.trim();

  // 1. VLESS: vless://uuid@host:port?query#name
  if (trimmed.startsWith("vless://")) {
    return parseVless(trimmed);
  }

  // 2. VMESS: vmess://base64
  if (trimmed.startsWith("vmess://")) {
    return parseVmess(trimmed);
  }

  // 3. TROJAN: trojan://password@host:port?query#name
  if (trimmed.startsWith("trojan://")) {
    return parseTrojan(trimmed);
  }

  // 4. SHADOWSOCKS: ss://...
  if (trimmed.startsWith("ss://")) {
    return parseShadowsocks(trimmed);
  }

  // 5. HYSTERIA 2: hysteria2:// or hy2://
  if (trimmed.startsWith("hysteria2://") || trimmed.startsWith("hy2://")) {
    return parseHysteria2(trimmed);
  }

  // 6. SOCKS5: socks5:// or socks://
  if (trimmed.startsWith("socks5://") || trimmed.startsWith("socks://")) {
    return parseSocks(trimmed);
  }

  // 7. HTTP / HTTPS: http:// or https://
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return parseHttpProxy(trimmed);
  }

  throw new Error("Неподдерживаемый протокол ссылки. Поддерживаются: vless://, vmess://, trojan://, ss://, hysteria2://, socks5://, http://");
}

function parseVless(rawUrl) {
  const parsed = new URL(rawUrl);
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

  if (flow) {
    outbound.flow = flow;
  }

  if (security === "reality" || security === "tls") {
    outbound.tls = {
      enabled: true,
      server_name: sni,
      utls: {
        enabled: true,
        fingerprint: fp
      }
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

  return { outbound, name: tag, protocol: "VLESS Reality", server: `${host}:${port}` };
}

function parseVmess(rawUrl) {
  const b64 = rawUrl.replace(/^vmess:\/\//, "").trim();
  const jsonStr = Buffer.from(b64, "base64").toString("utf-8");
  const data = JSON.parse(jsonStr);

  const host = data.add;
  const port = parseInt(data.port, 10);
  const uuid = data.id;
  const alterId = parseInt(data.aid, 10) || 0;
  const net = data.net || "tcp";
  const tag = data.ps || `VMess-${host}`;

  const outbound = {
    type: "vmess",
    tag: "proxy",
    server: host,
    server_port: port,
    uuid: uuid,
    alter_id: alterId,
    security: data.scy || "auto"
  };

  if (data.tls === "tls") {
    outbound.tls = {
      enabled: true,
      server_name: data.sni || data.host || host
    };
  }

  if (net === "ws") {
    outbound.transport = {
      type: "ws",
      path: data.path || "/",
      headers: data.host ? { Host: data.host } : undefined
    };
  } else if (net === "grpc") {
    outbound.transport = {
      type: "grpc",
      service_name: data.path || ""
    };
  }

  return { outbound, name: tag, protocol: "VMess", server: `${host}:${port}` };
}

function parseTrojan(rawUrl) {
  const parsed = new URL(rawUrl);
  const password = decodeURIComponent(parsed.username);
  const host = parsed.hostname;
  const port = parseInt(parsed.port, 10) || 443;
  const tag = decodeURIComponent(parsed.hash.replace(/^#/, "")) || `Trojan-${host}`;
  const query = parsed.searchParams;

  const outbound = {
    type: "trojan",
    tag: "proxy",
    server: host,
    server_port: port,
    password: password,
    tls: {
      enabled: true,
      server_name: query.get("sni") || host
    }
  };

  return { outbound, name: tag, protocol: "Trojan", server: `${host}:${port}` };
}

function parseShadowsocks(rawUrl) {
  // Format 1: ss://base64(method:password@host:port)#name
  // Format 2: ss://base64(method:password)@host:port#name
  const withoutPrefix = rawUrl.replace(/^ss:\/\//, "");
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
    // method:password@host:port
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

  return { outbound, name: tag, protocol: "Shadowsocks", server: `${host}:${port}` };
}

function parseHysteria2(rawUrl) {
  const parsed = new URL(rawUrl);
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

  return { outbound, name: tag, protocol: "Hysteria 2", server: `${host}:${port}` };
}

function parseSocks(rawUrl) {
  const parsed = new URL(rawUrl);
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

  return { outbound, name: tag, protocol: "SOCKS5", server: `${host}:${port}` };
}

function parseHttpProxy(rawUrl) {
  const parsed = new URL(rawUrl);
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

  return { outbound, name: tag, protocol: parsed.protocol === "https:" ? "HTTPS" : "HTTP", server: `${host}:${port}` };
}

// ==================== ГЕНЕРАЦИЯ КОНФИГА И ЗАПУСК ====================

function buildSingBoxConfig(outbound) {
  return {
    log: {
      level: "warn",
      timestamp: true
    },
    inbounds: [
      {
        type: "mixed",
        tag: "mixed-in",
        listen: "127.0.0.1",
        listen_port: PROXY_PORT
      }
    ],
    outbounds: [
      outbound,
      {
        type: "direct",
        tag: "direct"
      }
    ],
    route: {
      final: "proxy",
      auto_detect_interface: true
    }
  };
}

function stopCurrentProcess() {
  if (currentProcess) {
    try {
      currentProcess.kill();
    } catch {
      // process already dead
    }
    currentProcess = null;
  }
  // Дополнительно убиваем любые зависшие sing-box процессы
  try {
    execSync("taskkill /F /IM sing-box.exe 2>nul", { stdio: "ignore" });
  } catch {
    // ignore
  }
  currentConfig.running = false;
}

function startCore(outboundData) {
  stopCurrentProcess();

  const configObj = buildSingBoxConfig(outboundData.outbound);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(configObj, null, 2), "utf-8");

  console.log(`[Sing-Box] Запуск с профилем: ${outboundData.name} (${outboundData.protocol})`);

  const proc = spawn(CORE_PATH, ["run", "-c", CONFIG_PATH], {
    cwd: path.dirname(CORE_PATH),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  proc.stdout.on("data", (data) => console.log(`[core stdout] ${data.toString()}`));
  proc.stderr.on("data", (data) => console.error(`[core stderr] ${data.toString()}`));

  proc.on("exit", (code) => {
    console.log(`[Sing-Box] Процесс завершился с кодом: ${code}`);
    currentConfig.running = false;
    currentProcess = null;
  });

  currentProcess = proc;
  currentConfig = {
    running: true,
    rawUrl: outboundData.rawUrl || "",
    name: outboundData.name,
    protocol: outboundData.protocol,
    server: outboundData.server,
    port: PROXY_PORT
  };

  return currentConfig;
}

// ==================== REST API ДЛЯ РАСШИРЕНИЯ ====================

const server = http.createServer((req, res) => {
  // CORS заголовки
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // 1. Статус ядра
  if (req.method === "GET" && parsedUrl.pathname === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, ...currentConfig }));
    return;
  }

  // 2. Остановка ядра
  if (req.method === "POST" && parsedUrl.pathname === "/api/stop") {
    stopCurrentProcess();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Остановлено" }));
    return;
  }

  // 3. Подключение по ссылке
  if (req.method === "POST" && parsedUrl.pathname === "/api/connect") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        let link = payload.url ? payload.url.trim() : "";

        if (!link) {
          throw new Error("Ссылка не предоставлена");
        }

        // Если это ссылка на подписку (http/https с base64 содержимым)
        if (link.startsWith("http://") || link.startsWith("https://")) {
          // Проверяем, это подписка или одиночный HTTP-прокси
          if (link.includes("/sub") || link.includes("token=") || link.includes("/api/v1/client/subscribe")) {
            console.log(`[Subscription] Загрузка подписки по URL...`);
            const subRes = await fetch(link, { headers: { "User-Agent": "Happ/v1.0.0" } });
            const subText = await subRes.text();
            let decoded = subText;
            try {
              decoded = Buffer.from(subText.trim(), "base64").toString("utf-8");
            } catch {
              // already plain text
            }
            const lines = decoded.split(/\r?\n/).filter((l) => l.trim().length > 0);
            if (lines.length > 0) {
              link = lines[0].trim(); // Берем первый рабочий конфиг из подписки
              console.log(`[Subscription] Выбран сервер: ${link.slice(0, 30)}...`);
            }
          }
        }

        const outboundData = parseVpnUrl(link);
        outboundData.rawUrl = link;
        const result = startCore(outboundData);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, ...result }));
      } catch (err) {
        console.error("Ошибка подключения:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`=======================================================`);
  console.log(`  🛡️ Untitled Stealth - Лаунчер запущен на порту ${PORT}`);
  console.log(`  🚀 Порт локального прокси ядра: ${PROXY_PORT} (SOCKS5/HTTP)`);
  console.log(`  ✨ Поддерживает: VLESS (Reality), VMess, Trojan, SS, Hy2`);
  console.log(`=======================================================`);
});

// Корректное завершение
process.on("SIGINT", () => {
  stopCurrentProcess();
  process.exit();
});
process.on("SIGTERM", () => {
  stopCurrentProcess();
  process.exit();
});
