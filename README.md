<!--
Назначение: Кратко объясняет, как установить зависимости, запустить AITasker локально, подключить MCP и собрать Windows-версию.
Не входит: Полное описание архитектуры проекта, детальный справочник всех MCP tools и правила планирования задач.
-->

# AITasker

AITasker — Electron-приложение для работы с проектами, задачами и планами через MCP.

## Требования

- Windows 10/11
- Node.js 20+
- npm

## Установка

Установите зависимости:

```powershell
npm install
```

Если после установки или обновления зависимостей Electron ругается на `better-sqlite3` или `NODE_MODULE_VERSION`, пересоберите native-модуль:

```powershell
npm run rebuild:native
```

## Запуск в dev-режиме

Основной способ локальной разработки:

```powershell
npm run dev
```

Эта команда:

- запускает Vite для renderer
- собирает main/preload через `tsup --watch`
- поднимает Electron-окно
- стартует локальный MCP server

По умолчанию MCP endpoint:

```text
http://127.0.0.1:39291/mcp
```

Если нужен другой порт:

```powershell
$env:AITASKER_MCP_PORT="39300"
npm run dev
```

## Полезные команды

Собрать production-артефакты renderer и Electron:

```powershell
npm run build
```

Запустить Electron на уже собранных файлах:

```powershell
npm run preview
```

Проверить TypeScript:

```powershell
npm run typecheck
```

## Подключение MCP

Сначала запустите AITasker, затем подключите сервер в MCP-клиент.

### Claude Code

```powershell
claude mcp add --transport http aitasker http://127.0.0.1:39291/mcp
```

Проверка:

```powershell
claude mcp list
```

### Codex

```powershell
codex mcp add aitasker --url http://127.0.0.1:39291/mcp
```

Если порт переопределен через `AITASKER_MCP_PORT`, замените URL на свой endpoint.

## Сборка Windows-приложения

Собрать установщик `.exe`:

```powershell
npm run dist:win
```

Результат появится в каталоге `release/`:

- `release/AITasker Setup <version>.exe`
- `release/win-unpacked/`

## Типовые проблемы

### 1. Ошибка `better-sqlite3` или `NODE_MODULE_VERSION`

Пересоберите native-зависимость:

```powershell
npm run rebuild:native
```

Если проблема осталась, удалите `node_modules` и установите зависимости заново:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### 2. Не поднимается MCP endpoint

Проверьте, не занят ли порт `39291`, либо запустите приложение на другом порту:

```powershell
$env:AITASKER_MCP_PORT="39300"
npm run dev
```

### 3. Окно Electron не запускается или работает нестабильно

Проверьте, что `npm run build` или `npm run dev` завершается без ошибок. В этом проекте основная зона риска на Windows — Electron bootstrap и native-зависимости, поэтому сначала стоит перепроверить `better-sqlite3` и чистую пересборку.

### 4. После сборки нужен быстрый локальный запуск без dev server

Соберите проект и используйте:

```powershell
npm run build
npm run preview
```

## Где смотреть дальше

- [Instruction.md](./Instruction.md) — как устроен MCP-flow и работа с задачами
- [SKILL.md](./SKILL.md) — локальные правила и практики работы с проектом
