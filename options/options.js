/**
 * Untitled Stealth - Options Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  let currentState = null;

  // DOM Elements
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");

  const serversList = document.getElementById("serversList");
  const addServerBtn = document.getElementById("addServerBtn");
  const serverFormCard = document.getElementById("serverFormCard");
  const saveServerBtn = document.getElementById("saveServerBtn");
  const cancelServerBtn = document.getElementById("cancelServerBtn");

  const srvName = document.getElementById("srvName");
  const srvType = document.getElementById("srvType");
  const srvHost = document.getElementById("srvHost");
  const srvPort = document.getElementById("srvPort");

  const newDomainInput = document.getElementById("newDomainInput");
  const addNewDomainBtn = document.getElementById("addNewDomainBtn");
  const domainTagsContainer = document.getElementById("domainTagsContainer");
  const domainCount = document.getElementById("domainCount");
  const rawDomainsTextarea = document.getElementById("rawDomainsTextarea");
  const saveDomainsBtn = document.getElementById("saveDomainsBtn");
  const resetDomainsBtn = document.getElementById("resetDomainsBtn");

  // Загрузка состояния
  await loadState();

  // Навигация по вкладкам
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = item.getAttribute("data-tab");

      navItems.forEach((n) => n.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      item.classList.add("active");
      document.getElementById(`tab-${tabId}`).classList.add("active");
    });
  });

  // Открыть форму добавления сервера
  addServerBtn.addEventListener("click", () => {
    srvName.value = "";
    srvType.value = "socks5";
    srvHost.value = "127.0.0.1";
    srvPort.value = "10808";
    serverFormCard.style.display = "block";
    srvName.focus();
  });

  // Отмена добавления сервера
  cancelServerBtn.addEventListener("click", () => {
    serverFormCard.style.display = "none";
  });

  // Сохранение нового сервера
  saveServerBtn.addEventListener("click", async () => {
    const name = srvName.value.trim() || "Прокси";
    const type = srvType.value;
    const host = srvHost.value.trim() || "127.0.0.1";
    const port = parseInt(srvPort.value.trim(), 10) || 10808;

    const newServer = {
      id: "srv_" + Date.now(),
      name,
      type,
      host,
      port
    };

    currentState.servers.push(newServer);
    await saveState();
    serverFormCard.style.display = "none";
    renderServers();
  });

  // Добавление одиночного домена
  addNewDomainBtn.addEventListener("click", () => {
    addDomainFromInput();
  });

  newDomainInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      addDomainFromInput();
    }
  });

  function addDomainFromInput() {
    const val = newDomainInput.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
    if (val && !currentState.domains.includes(val)) {
      currentState.domains.unshift(val);
      newDomainInput.value = "";
      renderDomains();
      saveState();
    }
  }

  // Сохранение списка доменов из textarea
  saveDomainsBtn.addEventListener("click", async () => {
    const lines = rawDomainsTextarea.value
      .split("\n")
      .map((l) => l.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, ""))
      .filter((l) => l.length > 0);

    // Удаляем дубликаты
    currentState.domains = Array.from(new Set(lines));
    await saveState();
    renderDomains();

    saveDomainsBtn.textContent = "Сохранено ✓";
    setTimeout(() => {
      saveDomainsBtn.textContent = "Сохранить изменения";
    }, 1500);
  });

  // Сброс доменов по умолчанию
  resetDomainsBtn.addEventListener("click", async () => {
    if (confirm("Сбросить список сайтов к начальному состоянию?")) {
      currentState.domains = [
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
        "rutracker.org",
        "ntc.party",
        "notion.so",
        "openai.com",
        "chatgpt.com",
        "medium.com"
      ];
      await saveState();
      renderDomains();
    }
  });

  // Загрузка состояния
  async function loadState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (res) => {
        if (res && res.success) {
          currentState = res.state;
          renderServers();
          renderDomains();
        }
        resolve();
      });
    });
  }

  // Сохранение состояния
  async function saveState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "SAVE_CONFIG",
          data: {
            servers: currentState.servers,
            domains: currentState.domains,
            currentServerId: currentState.currentServerId
          }
        },
        () => resolve()
      );
    });
  }

  // Отрисовка серверов
  function renderServers() {
    serversList.innerHTML = "";
    currentState.servers.forEach((s) => {
      const card = document.createElement("div");
      card.className = "server-item" + (s.id === currentState.currentServerId ? " active" : "");

      const info = document.createElement("div");
      info.className = "server-info";
      info.innerHTML = `
        <h4>${escapeHtml(s.name)}</h4>
        <span>${escapeHtml(s.host)}:${s.port}</span>
      `;

      const badges = document.createElement("div");
      badges.className = "server-badges";

      const typeBadge = document.createElement("span");
      typeBadge.className = "badge-tag";
      typeBadge.textContent = s.type;
      badges.appendChild(typeBadge);

      if (s.id === currentState.currentServerId) {
        const activeBadge = document.createElement("span");
        activeBadge.className = "badge-tag";
        activeBadge.style.background = "#10b981";
        activeBadge.style.color = "#042f24";
        activeBadge.textContent = "Активен";
        badges.appendChild(activeBadge);
      } else {
        const makeActiveBtn = document.createElement("button");
        makeActiveBtn.className = "btn btn-secondary";
        makeActiveBtn.style.padding = "4px 8px";
        makeActiveBtn.style.fontSize = "11px";
        makeActiveBtn.textContent = "Выбрать";
        makeActiveBtn.onclick = async () => {
          currentState.currentServerId = s.id;
          await saveState();
          renderServers();
        };
        badges.appendChild(makeActiveBtn);
      }

      // Кнопка удаления (если серверов больше одного)
      if (currentState.servers.length > 1) {
        const delBtn = document.createElement("button");
        delBtn.className = "btn-del";
        delBtn.title = "Удалить сервер";
        delBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
        delBtn.onclick = async () => {
          if (confirm(`Удалить сервер "${s.name}"?`)) {
            currentState.servers = currentState.servers.filter((item) => item.id !== s.id);
            if (currentState.currentServerId === s.id) {
              currentState.currentServerId = currentState.servers[0].id;
            }
            await saveState();
            renderServers();
          }
        };
        badges.appendChild(delBtn);
      }

      card.appendChild(info);
      card.appendChild(badges);
      serversList.appendChild(card);
    });
  }

  // Отрисовка доменов
  function renderDomains() {
    domainCount.textContent = currentState.domains.length;
    rawDomainsTextarea.value = currentState.domains.join("\n");

    domainTagsContainer.innerHTML = "";
    currentState.domains.forEach((d) => {
      const tag = document.createElement("span");
      tag.className = "tag-item";
      tag.innerHTML = `
        <span>${escapeHtml(d)}</span>
        <span class="tag-remove" title="Удалить">×</span>
      `;
      tag.querySelector(".tag-remove").addEventListener("click", async () => {
        currentState.domains = currentState.domains.filter((item) => item !== d);
        await saveState();
        renderDomains();
      });
      domainTagsContainer.appendChild(tag);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
