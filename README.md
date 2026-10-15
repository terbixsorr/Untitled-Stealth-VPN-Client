# Untitled Stealth Desktop Client

<p align="center">
  <img src="icons/app.png" alt="Untitled Stealth Logo" width="96" height="96">
</p>

<p align="center">
  <b>Десктопный клиент VPN и прокси-соединений для Windows на базе ядра sing-box с поддержкой виртуального сетевого адаптера WinTun, протоколов VLESS Reality, Hysteria 2 и селективной маршрутизации.</b>
</p>

<p align="center">
  <a href="https://github.com/terbixsorr/Untitled-Stealth-VPN-Client/releases"><img src="https://img.shields.io/github/v/release/terbixsorr/Untitled-Stealth-VPN-Client?style=flat-square&color=0284c7" alt="Release"></a>
  <img src="https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20x64-334155?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Core-sing--box%20v1.14-059669?style=flat-square" alt="Sing-box">
  <img src="https://img.shields.io/badge/L3%20Driver-WinTun%20v0.14-6366f1?style=flat-square" alt="WinTun">
  <img src="https://img.shields.io/badge/License-MIT-475569?style=flat-square" alt="License">
</p>

---

## Обзор

**Untitled Stealth** — специализированный клиент сетевой маршрутизации и защищенных туннелей для операционных систем Windows 10 и 11. Приложение объединяет возможности высокопроизводительного ядра **sing-box**, драйвера сетевого уровня **WinTun** и модульного графического интерфейса на базе Electron, обеспечивая гибкую маршрутизацию трафика без необходимости ручной правки конфигурационных файлов.

---

## Архитектура и стек технологий

```
┌─────────────────────────────────────────────────────────────┐
│                    Графический интерфейс                    │
│            Electron 28 • HTML5/CSS3 • IPC Bridge            │
└──────────────────────────────┬──────────────────────────────┘
                               │ IPC Channels
┌──────────────────────────────▼──────────────────────────────┐
│                    Управляющий процесс                      │
│        Node.js Runtime • WinINet Controller • UAC Elev.     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Subprocess Control / PAC
┌──────────────────────────────▼──────────────────────────────┐
│                    Сетевое ядро sing-box                    │
│      L3 Virtual TUN Adapter (WinTun) • Outbound Engines     │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       ┌───────▼───────┐               ┌───────▼───────┐
       │   Hysteria 2  │               │ VLESS Reality │
       │   QUIC / UDP  │               │  TLS 1.3 SNI  │
       └───────────────┘               └───────────────┘
```

* **Frontend**: Electron, Context Isolation, Typed Preload IPC API.
* **Core Engine**: `sing-box` (Go-бинарник, скомпилированный под `windows/amd64`).
* **Kernel Network Driver**: `wintun.dll` (разработка WireGuard Project).
* **System Proxy Subsystem**: Нативная интеграция с Windows Internet API (`WinINet`) и генератор PAC-скриптов.

---

## Поддерживаемые протоколы и транспорты

| Протокол | Транспорт / Безопасность | Назначение и особенности |
| :--- | :--- | :--- |
| **Hysteria 2** | QUIC / UDP, TLS 1.3 | Высокая пропускная способность при высоких сетевых потерях и агрессивном троттлинге UDP/TCP провайдерами |
| **VLESS Reality** | TCP, XTLS Reality | Прямая маскировка сетевых рукопожатий под доверенные сторонние TLS-сертификаты без владения собственным доменом |
| **VMess** | TCP, WebSocket + TLS | Стандартная совместимость с инфраструктурой v2ray/Xray |
| **Trojan** | TCP, WebSocket + TLS | Эмуляция стандартного HTTPS-трафика |
| **Shadowsocks** | AEAD, 2022 Specification | Легковесное симметричное шифрование с минимальными накладными расходами |
| **SOCKS5 / HTTP** | TCP Cleartext / TLS | Локальные и удаленные шлюзы маршрутизации |
| **Subscriptions** | HTTP / HTTPS (Base64) | Автоматический импорт списков узлов из внешних источников |

---

## Сетевые режимы работы

### 1. Системный TUN-режим (L3 Virtual Adapter)
* Создает виртуальный сетевой интерфейс `wintun` на уровне ядра Windows.
* Осуществляет полный перехват как TCP-, так и UDP-пакетов операционной системы.
* Обеспечивает стабильную маршрутизацию трафика программ, не поддерживающих стандартный системный прокси: голосовые каналы Discord (WebRTC), звонки Telegram, игровые клиенты (Steam, Dota 2, CS2) и консольные утилиты.
* Требует запуска с правами локального Администратора (UAC-манифест встроен в загрузчик).

### 2. Селективный режим (Smart PAC Routing)
* Автоматическое разделение сетевых потоков через Proxy Auto-Configuration (PAC).
* Через защищенный туннель направляются только домены из заданного списка (YouTube, Discord, Telegram, X, GitHub, Rutracker и др.).
* Трафик банковских сервисов, государственных порталов и внутрироссийских ресурсов обрабатывается напрямую на скорости провайдера без дополнительных задержек.
* Возможность добавления и удаления пользовательских доменов в реальном времени.

### 3. Глобальный режим (Global System Proxy)
* Централизованное перенаправление всего системного HTTP/HTTPS трафика через выбранный прокси-сервер (`127.0.0.1:10808`).

---

## Постоянное хранилище и конфигурации

Все пользовательские данные изолированы от исполняемых файлов программы и сохраняются в системном каталоге профиля:

```
%APPDATA%\Untitled Stealth\
├── servers_history.json    # Профили и параметры подключений
├── settings.json           # Состояние TUN, активный сервер, автоподключение
└── domains_list.json       # Пользовательские доменные правила маршрутизации
```

Данные сохраняются при перезапуске системы, перезагрузке приложения и обновлении версий бинарного файла.

---

## Установка и развертывание

### Вариант 1. Автономный исполняемый файл (Standalone Portable EXE)
1. Загрузите файл **[`UntitledStealth-v1.0.0.exe`](https://github.com/terbixsorr/Untitled-Stealth-VPN-Client/releases)** со страницы [Releases](https://github.com/terbixsorr/Untitled-Stealth-VPN-Client/releases).
2. Запустите файл от имени Администратора.
3. Приложение автоматически инициализирует системный драйвер WinTun, создаст рабочий ярлык и развернет рабочую среду в `%LOCALAPPDATA%\Programs\UntitledStealth\`.

### Вариант 2. Сборка из исходного кода

**Требования:**
* Node.js v18.0.0 или выше;
* .NET Framework 4.5+ (для компиляции лаунчера `csc.exe`);
* Git.

```bash
# Клонирование репозитория
git clone https://github.com/terbixsorr/Untitled-Stealth-VPN-Client.git
cd Untitled-Stealth-VPN-Client

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Компиляция автономного EXE-пакета
node build_exe.js
```

---

## Безопасность

* Приложение не использует внешние телеметрические сервисы, системы аналитики и сторонние сборщики логов.
* Учетные данные, пароли и приватные ключи хранятся локально в закрытом пользовательском каталоге Windows.
* Сетевое ядро `sing-box` проходит регулярный аудит безопасности сообществом открытого ПО.

---

## Лицензирование

* Исходный код клиента лицензирован под [MIT License](LICENSE).
* Сетевое ядро [sing-box](https://github.com/SagerNet/sing-box) распространяется под лицензией GPLv3.
* Сетевой драйвер [WinTun](https://www.wintun.net/) распространяется под лицензией BSD/MIT.
