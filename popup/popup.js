/**
 * Untitled Stealth - Popup Controller (with Universal VPN Link Support)
 */

document.addEventListener("DOMContentLoaded", async () => {
  const toggleBtn = document.getElementById("toggleBtn");
  const powerRing = document.getElementById("powerRing");
  const statusText = document.getElementById("statusText");
  const pingBadge = document.getElementById("pingBadge");
  const pingValue = document.getElementById("pingValue");
  const openOptionsBtn = document.getElementById("openOptionsBtn");
  const footerEndpoint = document.getElementById("footerEndpoint");
  const quickActionArea = document.getElementById("quickActionArea");
  const currentDomainSpan = document.getElementById("currentDomain");
  const addCurrentDomainBtn = document.getElementById("addCurrentDomainBtn");
  const modePills = document.querySelectorAll(".mode-pill");

  const vpnUrlInput = document.getElementById("vpnUrlInput");
  const connectUrlBtn = document.getElementById("connectUrlBtn");
  const activeProfileInfo = document.getElementById("activeProfileInfo");
  const activeProfileName = document.getElementById("activeProfileName");

  const LAUNCHER_API = "http://127.0.0.1:18080";

  let currentState = null;
  let activeTabHostname = null;

  // Инициализация данных
  await loadState();
  await checkLauncherStatus();
  await checkCurrentTab();

  // Подключение по вставленной ссылке (VLESS, VMess, SS, Trojan, SOCKS5)
  connectUrlBtn.addEventListener("click", () => {
    handleConnectUrl();
  });

  vpnUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleConnectUrl();
    }
  });

  async function handleConnectUrl() {
    const rawUrl = vpnUrlInput.value.trim();
    if (!rawUrl) return;

    activeProfileName.textContent = "Подключение к ядру...";
    connectUrlBtn.disabled = true;

    try {
      const res = await fetch(`${LAUNCHER_API}/api/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl })
      });

      const data = await res.json();
      if (data.success) {
        activeProfileName.textContent = `✓ ${data.protocol}: ${data.name}`;
        activeProfileInfo.classList.add("active");
        vpnUrlInput.value = "";

        // Автоматически включаем прокси в расширении
        if (!currentState.enabled) {
          chrome.runtime.sendMessage({ type: "TOGGLE" }, (toggleRes) => {
            if (toggleRes && toggleRes.success) {
              currentState.enabled = true;
              renderState();
              testPing();
            }
          });
        } else {
          testPing();
        }
      } else {
        alert("Ошибка: " + (data.error || "Не удалось запустить конфигурацию"));
        activeProfileName.textContent = "Ошибка конфигурации";
      }
    } catch {
      alert("Лаунчер не запущен!\nПожалуйста, запустите файл start.bat в папке C:\\лаунчер");
      activeProfileName.textContent = "Запустите start.bat в C:\\лаунчер";
    } finally {
      connectUrlBtn.disabled = false;
    }
  }

  // Проверка статуса лаунчера
  async function checkLauncherStatus() {
    try {
      const res = await fetch(`${LAUNCHER_API}/api/status`, { signal: AbortSignal.timeout(1000) });
      const data = await res.json();
      if (data.success && data.running) {
        activeProfileName.textContent = `✓ ${data.protocol}: ${data.name}`;
        activeProfileInfo.classList.add("active");
        footerEndpoint.textContent = `Sing-Box: 127.0.0.1:${data.port}`;
      } else {
        activeProfileName.textContent = "Ядро готово: вставьте ссылку";
        activeProfileInfo.classList.remove("active");
      }
    } catch {
      activeProfileName.textContent = "Лаунчер: запустите start.bat";
      activeProfileInfo.classList.remove("active");
    }
  }

  // Нажатие кнопки Вкл/Выкл
  toggleBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "TOGGLE" }, (res) => {
      if (res && res.success) {
        currentState.enabled = res.enabled;
        renderState();
        if (currentState.enabled) {
          testPing();
        }
      }
    });
  });

  // Переключение режимов маршрутизации
  modePills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const mode = pill.getAttribute("data-mode");
      chrome.runtime.sendMessage({ type: "SET_MODE", mode }, (res) => {
        if (res && res.success) {
          currentState = res.state;
          renderState();
        }
      });
    });
  });

  // Клик по пингу
  pingBadge.addEventListener("click", () => {
    testPing();
  });

  // Открыть страницу настроек
  openOptionsBtn.addEventListener("click", () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL("options/options.html"));
    }
  });

  // Добавить текущий сайт в список
  addCurrentDomainBtn.addEventListener("click", () => {
    if (!activeTabHostname) return;
    chrome.runtime.sendMessage({ type: "ADD_DOMAIN", domain: activeTabHostname }, (res) => {
      if (res && res.success) {
        currentState.domains = res.domains;
        addCurrentDomainBtn.textContent = "Добавлено ✓";
        addCurrentDomainBtn.disabled = true;
        addCurrentDomainBtn.style.opacity = "0.6";
      }
    });
  });

  // Загрузка состояния из background
  async function loadState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
        if (res && res.success) {
          currentState = res.state;
          renderState();
          if (currentState.enabled) {
            testPing();
          }
        }
        resolve();
      });
    });
  }

  // Отрисовка состояния интерфейса
  function renderState() {
    if (!currentState) return;

    if (currentState.enabled) {
      powerRing.classList.add("active");
      statusText.classList.add("active");
      pingBadge.classList.add("active");
      statusText.textContent = "ЗАЩИТА АКТИВНА";
    } else {
      powerRing.classList.remove("active");
      statusText.classList.remove("active");
      pingBadge.classList.remove("active");
      statusText.textContent = "ОТКЛЮЧЕНО";
      pingValue.textContent = "— ms";
    }

    modePills.forEach((p) => {
      if (p.getAttribute("data-mode") === currentState.mode) {
        p.classList.add("active");
      } else {
        p.classList.remove("active");
      }
    });
  }

  // Проверка задержки (Ping)
  function testPing() {
    pingValue.textContent = "...";
    chrome.runtime.sendMessage({ type: "PING_SERVER" }, (res) => {
      if (res && res.success) {
        pingValue.textContent = `${res.latency} ms`;
        if (res.latency < 120) {
          pingValue.style.color = "#10b981";
        } else if (res.latency < 350) {
          pingValue.style.color = "#f59e0b";
        } else {
          pingValue.style.color = "#ef4444";
        }
      } else {
        pingValue.textContent = "Офлайн";
        pingValue.style.color = "#ef4444";
      }
    });
  }

  // Определение сайта на текущей вкладке
  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      const urlObj = new URL(tab.url);
      if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
        activeTabHostname = urlObj.hostname.replace(/^www\./, "");
        currentDomainSpan.textContent = activeTabHostname;
        quickActionArea.style.display = "flex";

        const alreadyInList = currentState.domains.some((d) => {
          const clean = d.trim().toLowerCase();
          return activeTabHostname === clean || activeTabHostname.endsWith("." + clean);
        });

        if (alreadyInList) {
          addCurrentDomainBtn.textContent = "В списке ✓";
          addCurrentDomainBtn.disabled = true;
          addCurrentDomainBtn.style.opacity = "0.6";
        } else {
          addCurrentDomainBtn.textContent = "+ В список";
          addCurrentDomainBtn.disabled = false;
          addCurrentDomainBtn.style.opacity = "1";
        }
      }
    } catch {
      quickActionArea.style.display = "none";
    }
  }
});
