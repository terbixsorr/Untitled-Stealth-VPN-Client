const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Управление ядром VPN
  connect: (url) => ipcRenderer.invoke("core:connect", url),
  disconnect: () => ipcRenderer.invoke("core:disconnect"),
  getStatus: () => ipcRenderer.invoke("core:get-status"),
  testPing: (url) => ipcRenderer.invoke("core:ping", url),
  testPingAll: () => ipcRenderer.invoke("core:ping-all"),
  clearActiveServer: () => ipcRenderer.invoke("core:clear-active"),
  getLogs: () => ipcRenderer.invoke("core:get-logs"),

  // Системный прокси, TUN и автозапуск
  setSystemProxy: (enabled, mode) => ipcRenderer.invoke("proxy:set-system", { enabled, mode }),
  setTunMode: (enabled) => ipcRenderer.invoke("proxy:set-tun", enabled),
  setAutostart: (enabled) => ipcRenderer.invoke("system:set-autostart", enabled),
  getAutostart: () => ipcRenderer.invoke("system:get-autostart"),

  // Хранилище серверов и доменов
  getSavedServers: () => ipcRenderer.invoke("storage:get-servers"),
  saveServer: (server) => ipcRenderer.invoke("storage:save-server", server),
  deleteServer: (id) => ipcRenderer.invoke("storage:delete-server", id),
  getDomains: () => ipcRenderer.invoke("storage:get-domains"),
  saveDomains: (domains) => ipcRenderer.invoke("storage:save-domains", domains),

  // Управление окном
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),

  // Подписка на события
  onStatusUpdate: (callback) => ipcRenderer.on("status:update", (event, data) => callback(data)),
  onLogUpdate: (callback) => ipcRenderer.on("log:update", (event, log) => callback(log))
});
