/**
 * Untitled Stealth v2.0 - Desktop Renderer Logic
 */

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const minBtn = document.getElementById("minBtn");
  const maxBtn = document.getElementById("maxBtn");
  const closeBtn = document.getElementById("closeBtn");

  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Dashboard elements
  const dashLinkInput = document.getElementById("dashLinkInput");
  const dashAddBtn = document.getElementById("dashAddBtn");
  const dashConnectBtn = document.getElementById("dashConnectBtn");

  const powerRing = document.getElementById("powerRing");
  const mainPowerBtn = document.getElementById("mainPowerBtn");
  const heroStatusText = document.getElementById("heroStatusText");
  const heroTimer = document.getElementById("heroTimer");

  const pingMetricPill = document.getElementById("pingMetricPill");
  const pingMetricValue = document.getElementById("pingMetricValue");
  const pingDot = document.getElementById("pingDot");
  const activeModeText = document.getElementById("activeModeText");

  const downSpeedEl = document.getElementById("downSpeed");
  const upSpeedEl = document.getElementById("upSpeed");
  const speedCanvas = document.getElementById("speedGraph");

  const activeNodeBanner = document.getElementById("activeNodeBanner");
  const nodeFlag = document.getElementById("nodeFlag");
  const nodeName = document.getElementById("nodeName");
  const nodeProtocol = document.getElementById("nodeProtocol");
  const nodeEndpoint = document.getElementById("nodeEndpoint");
  const clearActiveBtn = document.getElementById("clearActiveBtn");

  const sidebarDot = document.getElementById("sidebarDot");
  const sidebarStatus = document.getElementById("sidebarStatus");
  const sidebarEndpoint = document.getElementById("sidebarEndpoint");
  const serversCountBadge = document.getElementById("serversCountBadge");

  // Dashboard quick servers elements
  const dashServersCount = document.getElementById("dashServersCount");
  const dashServersGrid = document.getElementById("dashServersGrid");
  const dashUpdateSubsBtn = document.getElementById("dashUpdateSubsBtn");
  const dashGoServersTabBtn = document.getElementById("dashGoServersTabBtn");

  // Servers & Subscriptions elements
  const serversGrid = document.getElementById("serversGrid");
  const addServerFromServersTabBtn = document.getElementById("addServerFromServersTabBtn");
  const refreshAllSubsTopBtn = document.getElementById("refreshAllSubsTopBtn");
  const pingAllBtn = document.getElementById("pingAllBtn");
  const clearAllServersBtn = document.getElementById("clearAllServersBtn");
  const subsSection = document.getElementById("subsSection");
  const subsCountBadge = document.getElementById("subsCountBadge");
  const subsList = document.getElementById("subsList");

  // Routing elements
  const sysProxySwitch = document.getElementById("sysProxySwitch");
  const tunModeSwitch = document.getElementById("tunModeSwitch");
  const modeCards = document.querySelectorAll(".mode-card");
  const domainsCount = document.getElementById("domainsCount");
  const newDomainInput = document.getElementById("newDomainInput");
  const addDomainBtn = document.getElementById("addDomainBtn");
  const domainsTagsCloud = document.getElementById("domainsTagsCloud");
  const resetDomainsBtn = document.getElementById("resetDomainsBtn");

  // Logs & Settings
  const terminalBox = document.getElementById("terminalBox");
  const clearLogsBtn = document.getElementById("clearLogsBtn");
  const autostartSwitch = document.getElementById("autostartSwitch");
  const autoConnectSwitch = document.getElementById("autoConnectSwitch");

  let appState = await window.api.getStatus();
  let timerInterval = null;
  let speedInterval = null;
  let speedHistory = new Array(30).fill(0);

  // ==================== ОКОННЫЕ КНОПКИ ====================
  minBtn.addEventListener("click", () => window.api.minimizeWindow());
  maxBtn.addEventListener("click", () => window.api.maximizeWindow());
  closeBtn.addEventListener("click", () => window.api.closeWindow());

  // ==================== НАВИГАЦИЯ ПО ВКЛАДКАМ ====================
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const tabId = item.getAttribute("data-tab");
      navItems.forEach((n) => n.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      item.classList.add("active");
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.classList.add("active");

      if (tabId === "servers") {
        loadServers();
        loadSubscriptions();
      }
      if (tabId === "routing") loadDomains();
      if (tabId === "logs") loadLogs();
    });
  });

  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  initSpeedGraph();
  renderAppState(appState);
  loadServers();
  loadSubscriptions();
  loadDomains();
  loadAutostart();
  loadLogs();

  // ==================== КНОПКА ПИТАНИЯ ====================
  mainPowerBtn.addEventListener("click", async () => {
    if (appState.connected) {
      await window.api.disconnect();
    } else {
      if (appState.activeServer && appState.activeServer.rawUrl) {
        await window.api.connect(appState.activeServer.rawUrl);
      } else {
        const url = dashLinkInput.value.trim();
        if (url) {
          await window.api.connect(url);
          dashLinkInput.value = "";
        } else {
          alert("Пожалуйста, сначала вставьте ссылку на ваш VPN в поле вверху!");
        }
      }
    }
    appState = await window.api.getStatus();
    renderAppState(appState);
    if (appState.connected) runPing();
    loadServers();
  });

  // Быстрое подключение и сохранение по ссылке в шапке
  dashConnectBtn.addEventListener("click", () => handleConnectInput());
  if (dashAddBtn) {
    dashAddBtn.addEventListener("click", () => handleAddServerInput());
  }
  dashLinkInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleConnectInput();
  });

  async function handleAddServerInput() {
    const url = dashLinkInput.value.trim();
    if (!url) {
      alert("Пожалуйста, сначала вставьте ссылку или конфигурацию в поле ввода!");
      return;
    }

    dashAddBtn.disabled = true;
    const origSpan = dashAddBtn.querySelector("span");
    if (origSpan) origSpan.textContent = "Сохранение...";

    const res = await window.api.addServer(url);
    dashAddBtn.disabled = false;
    if (origSpan) origSpan.textContent = "Сохранить";

    if (res.success) {
      dashLinkInput.value = "";
      appState = await window.api.getStatus();
      renderAppState(appState);
      loadServers();
      loadSubscriptions();
      alert(`Конфигурация успешно сохранена! Всего в списке: ${res.count || (res.servers ? res.servers.length : 1)}`);
    } else {
      alert("Ошибка сохранения: " + (res.error || "Неподдерживаемый формат ссылки"));
    }
  }

  async function handleConnectInput() {
    const url = dashLinkInput.value.trim();
    if (!url) return;

    dashConnectBtn.disabled = true;
    dashConnectBtn.innerHTML = "<span>Загрузка...</span>";

    const res = await window.api.connect(url);
    dashConnectBtn.disabled = false;
    dashConnectBtn.innerHTML = `<span>Подключить</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;

    appState = await window.api.getStatus();
    renderAppState(appState);
    loadServers();
    loadSubscriptions();

    if (res.success) {
      dashLinkInput.value = "";
      runPing();
    } else {
      alert("Ошибка подключения: " + (res.error || "Не удалось запустить конфигурацию"));
    }
  }

  // Кнопка сброса активного сервера
  clearActiveBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    await window.api.clearActiveServer();
    appState = await window.api.getStatus();
    renderAppState(appState);
    loadServers();
  });

  // Пинг клик
  pingMetricPill.addEventListener("click", () => runPing());

  async function runPing() {
    pingMetricValue.textContent = "...";
    const latency = await window.api.testPing();
    if (latency !== null) {
      pingMetricValue.textContent = `${latency} ms`;
      pingDot.classList.add("active");
      if (latency < 120) {
        pingMetricValue.style.color = "#10b981";
      } else if (latency < 320) {
        pingMetricValue.style.color = "#f59e0b";
      } else {
        pingMetricValue.style.color = "#ef4444";
      }
    } else {
      pingMetricValue.textContent = "Офлайн";
      pingMetricValue.style.color = "#ef4444";
      pingDot.classList.remove("active");
    }
  }

  // ==================== МАРШРУТИЗАЦИЯ И РЕЖИМЫ ====================
  sysProxySwitch.addEventListener("change", async (e) => {
    await window.api.setSystemProxy(e.target.checked, appState.mode);
    appState = await window.api.getStatus();
  });

  if (tunModeSwitch) {
    tunModeSwitch.addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      activeModeText.textContent = (isChecked ? "TUN • " : "") + (appState.mode === "global" ? "ВСЕ САЙТЫ" : "УМНЫЙ");
      await window.api.setTunMode(isChecked);
      appState = await window.api.getStatus();
      tunModeSwitch.checked = Boolean(appState.tunMode);
      renderAppState(appState);
    });
  }

  modeCards.forEach((card) => {
    card.addEventListener("click", async () => {
      const mode = card.getAttribute("data-mode");
      modeCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      await window.api.setSystemProxy(sysProxySwitch.checked, mode);
      appState = await window.api.getStatus();
      renderAppState(appState);
    });
  });

  // ==================== ДОМЕНЫ ДЛЯ УМНОГО РЕЖИМА ====================
  addDomainBtn.addEventListener("click", () => addDomain());
  newDomainInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDomain();
  });

  async function addDomain() {
    const val = newDomainInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
    if (!val) return;

    const domains = await window.api.getDomains();
    if (!domains.includes(val)) {
      domains.unshift(val);
      await window.api.saveDomains(domains);
      newDomainInput.value = "";
      loadDomains();
    }
  }

  async function loadDomains() {
    const domains = await window.api.getDomains();
    domainsCount.textContent = domains.length;
    domainsTagsCloud.innerHTML = "";

    domains.forEach((d) => {
      const tag = document.createElement("span");
      tag.className = "domain-tag";
      tag.innerHTML = `
        <span>${escapeHtml(d)}</span>
        <span class="tag-del" title="Удалить">×</span>
      `;
      tag.querySelector(".tag-del").addEventListener("click", async () => {
        const updated = domains.filter((item) => item !== d);
        await window.api.saveDomains(updated);
        loadDomains();
      });
      domainsTagsCloud.appendChild(tag);
    });
  }

  resetDomainsBtn.addEventListener("click", async () => {
    if (confirm("Сбросить список сайтов к стандартным (YouTube, Discord, Telegram, Twitter и др.)?")) {
      const defaults = [
        "t.me", "telegram.org", "telesco.pe", "telegram.me", "tdesktop.com", "tx.me",
        "discord.com", "discordapp.com", "discord.gg", "discord.media", "discordapp.net", "discordstatus.com",
        "youtube.com", "googlevideo.com", "ytimg.com", "youtu.be", "ggpht.com",
        "instagram.com", "cdninstagram.com",
        "twitter.com", "x.com", "twimg.com", "t.co",
        "facebook.com", "fbcdn.net",
        "openai.com", "chatgpt.com", "medium.com", "spotify.com",
        "rutracker.org", "ntc.party", "notion.so"
      ];
      await window.api.saveDomains(defaults);
      loadDomains();
    }
  });

  // ==================== СПИСОК СЕРВЕРОВ И ПОДПИСОК ====================
  async function loadServers() {
    const servers = await window.api.getSavedServers();
    serversCountBadge.textContent = servers.length;
    renderDashboardServers(servers);
    serversGrid.innerHTML = "";

    if (servers.length === 0) {
      serversGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-dim);">
          <div style="font-size: 32px; margin-bottom: 8px;">🌐</div>
          <div>Нет сохраненных серверов. Вставьте ссылку подписки или узла в поле выше!</div>
        </div>
      `;
      return;
    }

    servers.forEach((srv) => {
      const card = document.createElement("div");
      const isCurrent = appState.activeServer && (appState.activeServer.id === srv.id || appState.activeServer.rawUrl === srv.rawUrl);
      card.className = "server-card-item" + (isCurrent ? " active" : "");

      const flag = getFlag(srv.name, srv.endpoint);

      card.innerHTML = `
        <div class="server-card-left">
          <span class="server-card-flag">${flag}</span>
          <div class="server-card-texts">
            <span class="server-card-title">${escapeHtml(srv.name)}</span>
            <span class="server-card-sub">${escapeHtml(srv.protocol)} • ${escapeHtml(srv.endpoint)}</span>
          </div>
        </div>
        <div class="server-card-right">
          <span class="ping-tag" id="ping_${srv.id}">— ms</span>
          <button class="btn-icon select-srv-btn" title="Сделать активным узлом" style="${isCurrent ? 'color: #10b981; border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.1);' : ''}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </button>
          <button class="btn-icon danger del-srv-btn" title="Удалить узел">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      card.addEventListener("click", async () => {
        if (isCurrent && !appState.connected) {
          await window.api.connect(srv.rawUrl);
        } else {
          await window.api.setActiveServer(srv.id);
        }
        appState = await window.api.getStatus();
        renderAppState(appState);
        runPing();
        loadServers();
      });

      const selectBtn = card.querySelector(".select-srv-btn");
      if (selectBtn) {
        selectBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await window.api.setActiveServer(srv.id);
          appState = await window.api.getStatus();
          renderAppState(appState);
          loadServers();
        });
      }

      card.querySelector(".del-srv-btn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await window.api.deleteServer(srv.id);
        appState = await window.api.getStatus();
        renderAppState(appState);
        loadServers();
      });

      serversGrid.appendChild(card);
    });
  }

  // ==================== БЫСТРЫЙ ВЫБОР УЗЛА НА ГЛАВНОЙ ====================
  function renderDashboardServers(servers) {
    if (!dashServersGrid) return;
    if (dashServersCount) dashServersCount.textContent = servers.length;
    dashServersGrid.innerHTML = "";

    if (servers.length === 0) {
      dashServersGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 22px; text-align: center; color: var(--text-dim); background: var(--bg-card); border: 1px dashed var(--border-light); border-radius: var(--radius-md);">
          <div style="font-size: 24px; margin-bottom: 6px;">⚡</div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-main);">Нет сохраненных узлов</div>
          <div style="font-size: 11px; margin-top: 4px; color: var(--text-muted);">Вставьте ссылку подписки или узла в строку выше для быстрого подключения</div>
        </div>
      `;
      return;
    }

    servers.forEach((srv) => {
      const card = document.createElement("div");
      const isCurrent = appState.activeServer && (appState.activeServer.id === srv.id || appState.activeServer.rawUrl === srv.rawUrl);
      card.className = "dash-server-card" + (isCurrent ? " active" : "");
      card.title = isCurrent ? "Текущий активный узел" : `Переключиться на ${srv.name}`;

      const flag = getFlag(srv.name, srv.endpoint);

      card.innerHTML = `
        <div class="dash-server-left">
          <span class="dash-server-flag">${flag}</span>
          <div class="dash-server-info">
            <span class="dash-server-name">${escapeHtml(srv.name)}</span>
            <span class="dash-server-meta">${escapeHtml(srv.protocol)} • ${escapeHtml(srv.endpoint)}</span>
          </div>
        </div>
        <div class="dash-server-right">
          <span class="ping-tag" id="dash_ping_${srv.id}">— ms</span>
          <div class="dash-server-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      `;

      card.addEventListener("click", async () => {
        if (isCurrent && !appState.connected) {
          // Если клик по уже выбранному узлу при отключенном VPN — подключаемся
          await window.api.connect(srv.rawUrl);
        } else {
          // Мгновенное переключение активного узла (если VPN подключен — трафик переключается на лету)
          await window.api.setActiveServer(srv.id);
        }
        appState = await window.api.getStatus();
        renderAppState(appState);
        loadServers();
        if (appState.connected) {
          runPing();
        }
      });

      dashServersGrid.appendChild(card);
    });
  }

  // ==================== УПРАВЛЕНИЕ ПОДПИСКАМИ ====================
  async function loadSubscriptions() {
    if (!subsSection || !subsList) return;
    const subs = await window.api.getSubscriptions();

    if (subsCountBadge) subsCountBadge.textContent = subs.length;

    if (!subs || subs.length === 0) {
      subsSection.style.display = "none";
      subsList.innerHTML = "";
      return;
    }

    subsSection.style.display = "flex";
    subsList.innerHTML = "";

    subs.forEach((sub) => {
      const card = document.createElement("div");
      card.className = "sub-card";

      // Трафик
      let trafficHtml = "";
      if (sub.userinfo && sub.userinfo.total > 0) {
        const usedGB = (sub.userinfo.used / (1024 ** 3)).toFixed(1);
        const totalGB = (sub.userinfo.total / (1024 ** 3)).toFixed(1);
        const pct = Math.min(100, Math.max(0, Math.round((sub.userinfo.used / sub.userinfo.total) * 100)));
        trafficHtml = `
          <div class="sub-traffic-box">
            <div class="sub-traffic-labels">
              <span>Трафик: ${usedGB} GB из ${totalGB} GB</span>
              <span>${pct}%</span>
            </div>
            <div class="sub-traffic-bar">
              <div class="sub-traffic-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      } else if (sub.userinfo && sub.userinfo.used > 0) {
        const usedGB = (sub.userinfo.used / (1024 ** 3)).toFixed(1);
        trafficHtml = `
          <div class="sub-traffic-box">
            <div class="sub-traffic-labels">
              <span>Трафик: использовано ${usedGB} GB (Безлимитно)</span>
              <span>—</span>
            </div>
          </div>
        `;
      }

      // Срок действия
      let expireText = "Бессрочно";
      if (sub.userinfo && sub.userinfo.expire) {
        const expDate = new Date(sub.userinfo.expire);
        expireText = expDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
      }

      const updatedDate = sub.lastUpdated
        ? new Date(sub.lastUpdated).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "Недавно";

      card.innerHTML = `
        <div class="sub-card-top">
          <div class="sub-card-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-cyan); flex-shrink: 0;">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <div>
              <div class="sub-card-name">${escapeHtml(sub.name || "Подписка")} <span class="badge" style="margin-left: 6px;">${sub.serverCount || 0} узлов</span></div>
              <div class="sub-card-url" title="${escapeHtml(sub.url)}">${escapeHtml(sub.url)}</div>
            </div>
          </div>
          <div class="sub-card-actions">
            <button class="btn btn-secondary btn-sm update-single-sub-btn" title="Обновить узлы и данные этой подписки">
              <svg class="spin-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Обновить</span>
            </button>
            <button class="btn-icon danger del-sub-btn" title="Удалить подписку и все её серверы">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        ${trafficHtml}
        <div class="sub-footer-meta">
          <span>Срок действия: <strong>${escapeHtml(expireText)}</strong></span>
          <span>Обновлено: <strong>${escapeHtml(updatedDate)}</strong></span>
        </div>
      `;

      const updBtn = card.querySelector(".update-single-sub-btn");
      if (updBtn) {
        updBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          updBtn.disabled = true;
          const spin = updBtn.querySelector(".spin-icon");
          if (spin) spin.classList.add("spinning");
          try {
            await window.api.updateSubscription(sub.id);
            appState = await window.api.getStatus();
            renderAppState(appState);
            loadServers();
            loadSubscriptions();
          } catch (err) {
            alert("Ошибка обновления подписки: " + err.message);
          } finally {
            updBtn.disabled = false;
            if (spin) spin.classList.remove("spinning");
          }
        });
      }

      const delBtn = card.querySelector(".del-sub-btn");
      if (delBtn) {
        delBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (confirm(`Удалить подписку "${sub.name}" и все связанные серверы?`)) {
            await window.api.deleteSubscription(sub.id);
            appState = await window.api.getStatus();
            renderAppState(appState);
            loadServers();
            loadSubscriptions();
          }
        });
      }

      subsList.appendChild(card);
    });
  }

  // Обновление всех подписок оптом
  async function triggerUpdateAllSubscriptions(btn) {
    if (btn) {
      btn.disabled = true;
      const spin = btn.querySelector(".spin-icon");
      if (spin) spin.classList.add("spinning");
    }

    try {
      const res = await window.api.updateAllSubscriptions();
      if (res.success) {
        appState = await window.api.getStatus();
        renderAppState(appState);
        loadServers();
        loadSubscriptions();
      } else {
        alert(res.error || "Не удалось обновить подписки");
      }
    } catch (err) {
      alert("Ошибка обновления подписок: " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        const spin = btn.querySelector(".spin-icon");
        if (spin) spin.classList.remove("spinning");
      }
    }
  }

  if (dashUpdateSubsBtn) {
    dashUpdateSubsBtn.addEventListener("click", () => triggerUpdateAllSubscriptions(dashUpdateSubsBtn));
  }
  if (refreshAllSubsTopBtn) {
    refreshAllSubsTopBtn.addEventListener("click", () => triggerUpdateAllSubscriptions(refreshAllSubsTopBtn));
  }
  if (dashGoServersTabBtn) {
    dashGoServersTabBtn.addEventListener("click", () => {
      const srvTab = document.querySelector('.nav-item[data-tab="servers"]');
      if (srvTab) srvTab.click();
    });
  }

  // Кнопка добавления сервера из вкладки Серверы
  if (addServerFromServersTabBtn) {
    addServerFromServersTabBtn.addEventListener("click", async () => {
      const url = prompt("Вставьте ссылку на VPN-узел (vless://, hysteria2://, ss://, trojan://) или ссылку на подписку:");
      if (url && url.trim()) {
        const res = await window.api.addServer(url.trim());
        if (res.success) {
          appState = await window.api.getStatus();
          renderAppState(appState);
          loadServers();
          loadSubscriptions();
          alert(`Успешно добавлено узлов: ${res.count || 1}`);
        } else {
          alert("Ошибка добавления: " + (res.error || "Неподдерживаемый формат"));
        }
      }
    });
  }

  // Тест пинга всех серверов
  pingAllBtn.addEventListener("click", async () => {
    pingAllBtn.disabled = true;
    pingAllBtn.querySelector("span").textContent = "Тестирование...";
    const results = await window.api.testPingAll();
    pingAllBtn.disabled = false;
    pingAllBtn.querySelector("span").textContent = "Тест пинга всех";

    Object.keys(results).forEach((id) => {
      const el = document.getElementById(`ping_${id}`);
      const dashEl = document.getElementById(`dash_ping_${id}`);
      const ms = results[id];
      const tagClass = "ping-tag " + (ms < 120 ? "fast" : (ms < 300 ? "medium" : "slow"));
      if (el) {
        el.textContent = `${ms} ms`;
        el.className = tagClass;
      }
      if (dashEl) {
        dashEl.textContent = `${ms} ms`;
        dashEl.className = tagClass;
      }
    });
  });

  clearAllServersBtn.addEventListener("click", async () => {
    if (confirm("Удалить все сохраненные серверы из списка?")) {
      const servers = await window.api.getSavedServers();
      for (const s of servers) {
        await window.api.deleteServer(s.id);
      }
      await window.api.clearActiveServer();
      appState = await window.api.getStatus();
      renderAppState(appState);
      loadServers();
      loadSubscriptions();
    }
  });

  // ==================== ЖУРНАЛ (LOGS) ====================
  async function loadLogs() {
    const logs = await window.api.getLogs();
    terminalBox.innerHTML = "";
    logs.forEach((l) => appendLogLine(l));
    terminalBox.scrollTop = terminalBox.scrollHeight;
  }

  function appendLogLine(text) {
    const line = document.createElement("div");
    line.className = "terminal-line";
    line.textContent = text;
    terminalBox.appendChild(line);
    terminalBox.scrollTop = terminalBox.scrollHeight;
  }

  window.api.onLogUpdate((entry) => {
    appendLogLine(entry);
  });

  clearLogsBtn.addEventListener("click", () => {
    terminalBox.innerHTML = '<div class="terminal-line">[Система] Журнал очищен</div>';
  });

  // ==================== АВТОЗАПУСК И НАСТРОЙКИ ====================
  async function loadAutostart() {
    const isAuto = await window.api.getAutostart();
    autostartSwitch.checked = Boolean(isAuto);
    if (autoConnectSwitch) {
      autoConnectSwitch.checked = Boolean(appState.autoConnect);
    }
  }

  autostartSwitch.addEventListener("change", async (e) => {
    await window.api.setAutostart(e.target.checked);
  });

  if (autoConnectSwitch) {
    autoConnectSwitch.addEventListener("change", async (e) => {
      await window.api.setAutoConnect(e.target.checked);
      appState.autoConnect = e.target.checked;
    });
  }

  // ==================== ОТРИСОВКА СОСТОЯНИЯ ====================
  function renderAppState(state) {
    if (state.connected) {
      powerRing.classList.add("active");
      heroStatusText.classList.add("active");
      heroStatusText.textContent = "ЗАЩИТА АКТИВНА";

      sidebarDot.classList.add("active");
      sidebarStatus.classList.add("active");
      sidebarStatus.textContent = "ПОДКЛЮЧЕНО";

      startTimer(state.connectedAt || Date.now());
      startSpeedSimulation();
    } else {
      powerRing.classList.remove("active");
      heroStatusText.classList.remove("active");
      heroStatusText.textContent = "ОТКЛЮЧЕНО";

      sidebarDot.classList.remove("active");
      sidebarStatus.classList.remove("active");
      sidebarStatus.textContent = "ОТКЛЮЧЕНО";

      stopTimer();
      stopSpeedSimulation();
    }

    // Активный режим
    activeModeText.textContent = (state.tunMode ? "TUN • " : "") + (state.mode === "global" ? "ВСЕ САЙТЫ" : "УМНЫЙ");
    modeCards.forEach((c) => {
      if (c.getAttribute("data-mode") === state.mode) {
        c.classList.add("active");
      } else {
        c.classList.remove("active");
      }
    });

    sysProxySwitch.checked = Boolean(state.systemProxy);
    if (tunModeSwitch) {
      tunModeSwitch.checked = Boolean(state.tunMode);
    }

    // Карточка активного узла
    if (state.activeServer) {
      nodeFlag.textContent = getFlag(state.activeServer.name, state.activeServer.endpoint);
      nodeName.textContent = state.activeServer.name || "Узел подключен";
      nodeProtocol.textContent = state.activeServer.protocol || "VPN";
      nodeEndpoint.textContent = state.activeServer.endpoint || "";
      clearActiveBtn.style.display = "flex";
      sidebarEndpoint.textContent = state.activeServer.endpoint || "127.0.0.1:10808";
    } else {
      nodeFlag.textContent = "🌐";
      nodeName.textContent = "Нет активного сервера";
      nodeProtocol.textContent = "VPN";
      nodeEndpoint.textContent = "Вставьте ссылку выше для запуска";
      clearActiveBtn.style.display = "none";
      sidebarEndpoint.textContent = "127.0.0.1:10808";
    }
  }

  // Обновление от бэкенда
  window.api.onStatusUpdate((state) => {
    appState = state;
    renderAppState(state);
    loadServers();
    loadSubscriptions();
  });

  // ==================== ТАЙМЕР СЕССИИ ====================
  function startTimer(startTime) {
    stopTimer();
    updateTimerText(startTime);
    timerInterval = setInterval(() => updateTimerText(startTime), 1000);
  }

  function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    heroTimer.textContent = "00:00:00";
  }

  function updateTimerText(startTime) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const hrs = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const mins = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const secs = String(elapsed % 60).padStart(2, "0");
    heroTimer.textContent = `${hrs}:${mins}:${secs}`;
  }

  // ==================== СКОРОСТЬ И ГРАФИК ====================
  function initSpeedGraph() {
    drawSpeedCanvas();
  }

  function startSpeedSimulation() {
    stopSpeedSimulation();
    speedInterval = setInterval(() => {
      // Имитация активности трафика с плавными колебаниями
      const down = (Math.random() * 2.8 + 0.4).toFixed(1);
      const up = (Math.random() * 450 + 60).toFixed(0);

      downSpeedEl.innerHTML = `${down} <span>MB/s</span>`;
      upSpeedEl.innerHTML = `${up} <span>KB/s</span>`;

      speedHistory.shift();
      speedHistory.push(parseFloat(down));
      drawSpeedCanvas();
    }, 1000);
  }

  function stopSpeedSimulation() {
    if (speedInterval) clearInterval(speedInterval);
    speedInterval = null;
    downSpeedEl.innerHTML = "0.0 <span>KB/s</span>";
    upSpeedEl.innerHTML = "0.0 <span>KB/s</span>";
    speedHistory = new Array(30).fill(0);
    drawSpeedCanvas();
  }

  function drawSpeedCanvas() {
    if (!speedCanvas) return;
    const ctx = speedCanvas.getContext("2d");
    const w = speedCanvas.width;
    const h = speedCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Сетка
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // График волны
    const max = Math.max(...speedHistory, 3.5);
    ctx.beginPath();
    ctx.moveTo(0, h);

    const step = w / (speedHistory.length - 1);
    for (let i = 0; i < speedHistory.length; i++) {
      const val = speedHistory[i];
      const y = h - (val / max) * (h - 8);
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Градиентная заливка
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(16, 185, 129, 0.25)");
    grad.addColorStop(1, "rgba(16, 185, 129, 0)");
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ==================== ОПРЕДЕЛЕНИЕ ФЛАГА СТРАНЫ ====================
  function getFlag(name, endpoint) {
    const text = ((name || "") + " " + (endpoint || "")).toLowerCase();
    if (text.includes("нидерланд") || text.includes("netherland") || text.includes("nl")) return "🇳🇱";
    if (text.includes("герман") || text.includes("german") || text.includes("de")) return "🇩🇪";
    if (text.includes("сша") || text.includes("usa") || text.includes("us") || text.includes("america")) return "🇺🇸";
    if (text.includes("росси") || text.includes("russia") || text.includes("ru")) return "🇷🇺";
    if (text.includes("турци") || text.includes("turkey") || text.includes("tr")) return "🇹🇷";
    if (text.includes("франци") || text.includes("france") || text.includes("fr")) return "🇫🇷";
    if (text.includes("финлянд") || text.includes("finland") || text.includes("fi")) return "🇫🇮";
    if (text.includes("швеци") || text.includes("sweden") || text.includes("se")) return "🇸🇪";
    if (text.includes("великобритан") || text.includes("uk") || text.includes("britain") || text.includes("gb")) return "🇬🇧";
    if (text.includes("польш") || text.includes("poland") || text.includes("pl")) return "🇵🇱";
    if (text.includes("япони") || text.includes("japan") || text.includes("jp")) return "🇯🇵";
    if (text.includes("казахстан") || text.includes("kazakhstan") || text.includes("kz")) return "🇰🇿";
    if (text.includes("латви") || text.includes("latvia") || text.includes("lv")) return "🇱🇻";
    return "🌐";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }
});
