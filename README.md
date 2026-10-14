# ⚡ Untitled Stealth — Desktop VPN & Proxy Launcher

<p align="center">
  <img src="icons/app.png" alt="Untitled Stealth Logo" width="128" height="128">
</p>

<p align="center">
  <b>Ультра-быстрый десктопный VPN-клиент на ядре sing-box v1.14 с поддержкой TUN (WinTun), Hysteria 2, VLESS Reality и умной маршрутизацией для Windows.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-00f0ff?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-3b82f6?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/Core-sing--box%20v1.14-10b981?style=for-the-badge" alt="Sing-box">
  <img src="https://img.shields.io/badge/TUN-WinTun%20Driver-8b5cf6?style=for-the-badge" alt="WinTun">
  <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="License">
</p>

---

## ✨ Ключевые возможности

- 🚀 **Поддержка современных протоколов:**
  - **Hysteria 2** (максимальная скорость на базе QUIC/UDP, обход агрессивного троттлинга).
  - **VLESS Reality** (маскировка под легитимный TLS-трафик, защита от DPI).
  - **VMess, Shadowsocks, Trojan, SOCKS5, HTTP**.
  - **Автоматическая загрузка подписок** по HTTP/HTTPS ссылкам.
- 🛡 **Режим TUN (Виртуальный сетевой адаптер WinTun):**
  - Захват сетевого трафика на уровне ядра Windows.
  - Полноценная работа голосовых каналов в **Discord** и звонков в **Telegram**.
  - Пропуск игрового трафика (**Dota 2**, **CS2**, **Steam**) с минимальным пингом.
- 🧠 **Умная маршрутизация (Smart PAC Routing):**
  - Автоматическое разделение трафика: через прокси идут только заблокированные ресурсы (YouTube, Discord, Telegram, Instagram, Twitter/X, Rutracker и др.).
  - Банки, Госуслуги, маркетплейсы и локальные сайты работают **напрямую на скорости вашего провайдера**.
  - Возможность добавлять и удалять собственные домены в один клик прямо в приложении.
- 🌐 **Глобальный режим (Global):**
  - Направление 100% трафика системы через выбранный защищенный узел.
- 🪟 **Интеграция с Windows:**
  - Нативное переключение системного прокси Windows в один клик.
  - Сворачивание в системный трей с контекстным меню быстрого управления.
  - Автозапуск при старте Windows (опционально).
  - Автоматический запрос прав администратора (UAC) для создания адаптера WinTun.
- 📊 **Телеметрия в реальном времени:**
  - Живой замер пинга (Latency / RTT) до сервера.
  - График и счетчики скорости скачивания и отдачи.
- 🎨 **Obsidian Cyberpunk UI:**
  - Стильный темный интерфейс с неоновой анимацией кольца питания и статуса защиты.

---

## 🚀 Установка и запуск

### Вариант 1: Готовый автономный файл (Single EXE) — Рекомендуется

1. Скачайте **[`UntitledStealth-v1.0.0.exe`](https://github.com/terbixsorr/Untitled-Stealth-VPN-Client/releases)** из раздела [Releases](https://github.com/terbixsorr/Untitled-Stealth-VPN-Client/releases).
2. Запустите файл (при первом запуске Windows запросит права администратора для WinTun).
3. Приложение автоматически распакует необходимые компоненты в `%LOCALAPPDATA%\Programs\UntitledStealth\` и создаст ярлык на рабочем столе.
4. Вставьте ссылку на ваш узел (Hysteria 2, VLESS и др.) и нажмите **«Подключить»**!

---

### Вариант 2: Запуск из исходного кода

Требуется установленный [Node.js](https://nodejs.org/) (v18+):

```bash
# Клонируйте репозиторий
git clone https://github.com/terbixsorr/Untitled-Stealth-VPN-Client.git
cd Untitled-Stealth-VPN-Client

# Установите зависимости
npm install

# Запуск приложения
npm start
```

---

## 📂 Структура проекта

```
├── core/                      # Ядро и сетевые драйверы
│   ├── sing-box.exe           # Высокопроизводительное ядро sing-box v1.14
│   ├── wintun.dll             # Высокоскоростной драйвер виртуального адаптера WinTun
│   └── proxy.pac              # Скрипт автоматической маршрутизации Windows
├── desktop/                   # Пользовательский интерфейс (UI)
│   ├── index.html             # Главная разметка лаунчера (Obsidian theme)
│   ├── renderer.js            # Логика UI, телеметрия, графики, валидация
│   └── style.css              # Неоновые темные стили и анимации
├── icons/                     # Иконки приложения (ICO, PNG)
├── main.js                    # Electron Main Process (управление sing-box, IPC, TUN)
├── preload.js                 # Безопасный IPC мост между Electron и веб-страницей
├── domains_list.json          # Список доменов для умного режима
├── settings.json              # Сохраненные настройки клиента
├── StandaloneLauncher.cs      # C# загрузчик для сборки в единый автономный EXE
└── build_exe.js               # Скрипт сборки Single EXE файла
```

---

## 🔒 Безопасность и конфиденциальность

- Все конфигурации, ключи серверов и учетные данные хранятся **исключительно локально** на вашем компьютере.
- Приложение не ведет внешних телеметрических логов и не передает ваши данные сторонним серверам.
- Полностью открытый исходный код под лицензией MIT.

---

## 📄 Лицензия

Проект распространяется под лицензией [MIT](LICENSE).
Ядро [sing-box](https://github.com/SagerNet/sing-box) распространяется под лицензией GPLv3 / Open Source.
Драйвер [WinTun](https://www.wintun.net/) лицензирован под MIT/BSD.
