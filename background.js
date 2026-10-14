/**
 * Untitled Stealth - Background Script
 * Full Cross-browser Proxy Controller (Optimized for Firefox + Chromium)
 */

const DEFAULT_SERVERS = [
  {
    id: "happ_xray_local",
    name: "Happ / Xray Local (SOCKS5)",
    type: "socks5",
    host: "127.0.0.1",
    port: 10808
  },
  {
    id: "singbox_local",
    name: "Sing-box / Hiddify Local (SOCKS5)",
    type: "socks5",
    host: "127.0.0.1",
    port: 2080
  },
  {
    id: "custom_socks5",
    name: "Пользовательский SOCKS5",
    type: "socks5",
    host: "127.0.0.1",
    port: 1080
  }
];

const DEFAULT_DOMAINS = [
  "youtube.com",
  "googlevideo.com",
  "ytimg.com",
  "youtu.be",
  "ggpht.com",
  "discord.com",
  "discordapp.com",
  "discord.gg",
  "discord.media",
  "instagram.com",
  "cdninstagram.com",
  "twitter.com",
  "x.com",
  "twimg.com",
  "t.co",
  "rutracker.org",
  "ntc.party",
  "notion.so",
  "openai.com",
  "chatgpt.com",
  "medium.com"
];

let globalState = {
  enabled: false,
  mode: "smart", // "smart", "global", "bypass"
  currentServerId: "happ_xray_local",
  servers: DEFAULT_SERVERS,
  domains: DEFAULT_DOMAINS
};

// Проверяем, запущено ли в Firefox
const isFirefox = typeof browser !== "undefined" && Boolean(browser?.proxy?.onRequest);

// Инициализация при старте
async function init() {
  const existing = await chrome.storage.local.get(null);
  globalState = {
    ...globalState,
    ...existing,
    servers: existing.servers && existing.servers.length > 0 ? existing.servers : DEFAULT_SERVERS,
    domains: existing.domains && existing.domains.length > 0 ? existing.domains : DEFAULT_DOMAINS
  };

  await chrome.storage.local.set(globalState);

  // Настройка под Firefox или Chromium
  if (isFirefox) {
    setupFirefoxProxy();
  } else {
    await updateChromeProxy(globalState);
  }

  updateBadge(globalState.enabled, getBadgeText(globalState));
}

init();

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

// ==================== FIREFOX РЕАЛИЗАЦИЯ ====================
function setupFirefoxProxy() {
  try {
    if (browser.proxy.onRequest.hasListener(handleFirefoxProxyRequest)) {
      browser.proxy.onRequest.removeListener(handleFirefoxProxyRequest);
    }
  } catch {
    // listener might not exist yet
  }

  browser.proxy.onRequest.addListener(handleFirefoxProxyRequest, { urls: ["<all_urls>"] });
  console.log("Untitled Stealth: Firefox proxy listener активирован");
}

function handleFirefoxProxyRequest(requestInfo) {
  if (!globalState.enabled) {
    return [{ type: "direct" }];
  }

  const server = globalState.servers.find((s) => s.id === globalState.currentServerId) || globalState.servers[0];
  if (!server) {
    return [{ type: "direct" }];
  }

  const proxyType = server.type === "socks5" ? "socks" : server.type === "https" ? "https" : "http";
  const proxyConfig = {
    type: proxyType,
    host: server.host,
    port: parseInt(server.port, 10),
    proxyDNS: server.type === "socks5" // Резолвит DNS на прокси-сервере (защита от DNS-блокировок)
  };

  // 1. Режим: Все сайты
  if (globalState.mode === "global") {
    return [proxyConfig];
  }

  // 2. Режим: Умный или Обход
  let urlObj;
  try {
    urlObj = new URL(requestInfo.url);
  } catch {
    return [{ type: "direct" }];
  }

  const host = urlObj.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return [{ type: "direct" }];
  }

  const isMatched = globalState.domains.some((d) => {
    const clean = d.trim().toLowerCase();
    return host === clean || (host.length > clean.length && host.endsWith("." + clean));
  });

  if (globalState.mode === "smart") {
    return isMatched ? [proxyConfig] : [{ type: "direct" }];
  } else if (globalState.mode === "bypass") {
    return isMatched ? [{ type: "direct" }] : [proxyConfig];
  }

  return [{ type: "direct" }];
}

// ==================== CHROMIUM РЕАЛИЗАЦИЯ ====================
function generatePacScript(server, domains, mode) {
  let proxyStr = "";
  if (server.type === "socks5") {
    proxyStr = `SOCKS5 ${server.host}:${server.port}; SOCKS ${server.host}:${server.port}; DIRECT`;
  } else if (server.type === "https") {
    proxyStr = `HTTPS ${server.host}:${server.port}; DIRECT`;
  } else {
    proxyStr = `PROXY ${server.host}:${server.port}; DIRECT`;
  }

  const cleanDomains = domains
    .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, ""))
    .filter(Boolean);

  const jsonList = JSON.stringify(cleanDomains);

  return `
    var stealthList = ${jsonList};
    function FindProxyForURL(url, host) {
      if (isPlainHostName(host) || host === "127.0.0.1" || host === "localhost") {
        return "DIRECT";
      }
      var h = host.toLowerCase();
      var found = false;
      for (var i = 0; i < stealthList.length; i++) {
        var d = stealthList[i];
        if (h === d || (h.length > d.length && h.lastIndexOf("." + d) === h.length - d.length - 1)) {
          found = true;
          break;
        }
      }
      ${mode === "smart" ? `return found ? "${proxyStr}" : "DIRECT";` : `return found ? "DIRECT" : "${proxyStr}";`}
    }
  `;
}

async function updateChromeProxy(state) {
  if (isFirefox) return; // В Firefox используется native browser.proxy.onRequest

  if (!chrome.proxy || !chrome.proxy.settings) return;

  if (!state.enabled) {
    await new Promise((resolve) => {
      chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" }, resolve);
    });
    return;
  }

  const server = state.servers.find((s) => s.id === state.currentServerId) || state.servers[0];
  if (!server) return;

  if (state.mode === "global") {
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: server.type,
          host: server.host,
          port: parseInt(server.port, 10)
        },
        bypassList: ["<local>", "127.0.0.1", "localhost"]
      }
    };
    await new Promise((resolve) => {
      chrome.proxy.settings.set({ value: config, scope: "regular" }, resolve);
    });
  } else {
    const pacData = generatePacScript(server, state.domains, state.mode);
    const config = {
      mode: "pac_script",
      pacScript: { data: pacData }
    };
    await new Promise((resolve) => {
      chrome.proxy.settings.set({ value: config, scope: "regular" }, resolve);
    });
  }
}

// ==================== УПРАВЛЕНИЕ СТАТУСОМ ====================
function getBadgeText(state) {
  if (!state.enabled) return "";
  if (state.mode === "global") return "ALL";
  if (state.mode === "smart") return "SMART";
  return "BYP";
}

function updateBadge(active, text = "") {
  const actionApi = chrome.action || (typeof browser !== "undefined" && browser.browserAction);
  if (actionApi) {
    if (active) {
      actionApi.setBadgeText({ text: text || "ON" });
      actionApi.setBadgeBackgroundColor({ color: "#10b981" });
      actionApi.setTitle({ title: `Untitled Stealth: Активен (${text})` });
    } else {
      actionApi.setBadgeText({ text: "" });
      actionApi.setTitle({ title: "Untitled Stealth: Отключен" });
    }
  }
}

// ==================== ОБРАБОТКА СООБЩЕНИЙ ====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "GET_STATE": {
        sendResponse({ success: true, state: globalState });
        break;
      }

      case "TOGGLE": {
        globalState.enabled = !globalState.enabled;
        await chrome.storage.local.set({ enabled: globalState.enabled });
        if (!isFirefox) await updateChromeProxy(globalState);
        updateBadge(globalState.enabled, getBadgeText(globalState));
        sendResponse({ success: true, enabled: globalState.enabled });
        break;
      }

      case "SET_MODE": {
        globalState.mode = message.mode;
        await chrome.storage.local.set({ mode: globalState.mode });
        if (!isFirefox) await updateChromeProxy(globalState);
        updateBadge(globalState.enabled, getBadgeText(globalState));
        sendResponse({ success: true, state: globalState });
        break;
      }

      case "SET_SERVER": {
        globalState.currentServerId = message.serverId;
        await chrome.storage.local.set({ currentServerId: globalState.currentServerId });
        if (!isFirefox) await updateChromeProxy(globalState);
        sendResponse({ success: true, state: globalState });
        break;
      }

      case "SAVE_CONFIG": {
        globalState = {
          ...globalState,
          ...message.data
        };
        await chrome.storage.local.set(globalState);
        if (!isFirefox) await updateChromeProxy(globalState);
        updateBadge(globalState.enabled, getBadgeText(globalState));
        sendResponse({ success: true, state: globalState });
        break;
      }

      case "ADD_DOMAIN": {
        const domain = message.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
        if (domain && !globalState.domains.includes(domain)) {
          globalState.domains.unshift(domain);
          await chrome.storage.local.set({ domains: globalState.domains });
          if (!isFirefox) await updateChromeProxy(globalState);
        }
        sendResponse({ success: true, domains: globalState.domains });
        break;
      }

      case "REMOVE_DOMAIN": {
        globalState.domains = globalState.domains.filter((d) => d !== message.domain);
        await chrome.storage.local.set({ domains: globalState.domains });
        if (!isFirefox) await updateChromeProxy(globalState);
        sendResponse({ success: true, domains: globalState.domains });
        break;
      }

      case "PING_SERVER": {
        const startTime = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          await fetch("https://1.1.1.1/cdn-cgi/trace", {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-store",
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          sendResponse({ success: true, latency: Date.now() - startTime });
        } catch (e) {
          sendResponse({ success: false, error: e.name === "AbortError" ? "Таймаут" : "Ошибка" });
        }
        break;
      }

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  })();

  return true;
});
