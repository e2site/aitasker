<!--
Purpose: Explain how to run AITasker in MCP-only mode and connect an external agent such as Claude Code to tasks and plans.
Out of scope: SDK-based provider integration, cloud deployment, and production packaging.
-->

# Instruction

## Текущий режим проекта

Теперь проект работает только через MCP.

Что это означает:

- внутри Electron-приложения больше нет встроенной SDK-интеграции с Anthropic или OpenAI
- приложение само не вызывает LLM для генерации плана
- планирование делает внешний MCP-клиент, например `Claude Code`
- AITasker хранит задачи и планы, отдает их через MCP и принимает сохраненный Markdown обратно

## Что умеет AITasker сейчас

Приложение:

- создает локальные задачи
- хранит их в SQLite
- показывает текущий Markdown-план
- позволяет редактировать план вручную
- поднимает локальный MCP HTTP server

Через MCP доступны:

- tools:
  - `create_task`
  - `list_tasks`
  - `find_tasks`
  - `get_task`
  - `get_plan`
  - `save_plan`
  - `append_plan_note`
- resources:
  - `task://{id}`
  - `plan://{taskId}`
- prompt:
  - `plan_task`

## Как запустить приложение

```powershell
npm install
```

Если после установки Electron ругается на `better-sqlite3` и `NODE_MODULE_VERSION`, пересобери native-модуль:

```powershell
npm run rebuild:native
```

Запуск:

```powershell
npm run dev
```

## MCP endpoint

По умолчанию MCP server поднимается на:

```text
http://127.0.0.1:39291/mcp
```

Если нужен другой порт:

```powershell
$env:AITASKER_MCP_PORT="39300"
npm run dev
```

Тогда endpoint будет:

```text
http://127.0.0.1:39300/mcp
```

## Как подключить AITasker к Claude Code

Когда AITasker уже запущен, в отдельном терминале выполни:

```powershell
claude mcp add --transport http aitasker http://127.0.0.1:39291/mcp
```

Если порт переопределен, замени URL на свой.

Проверка:

```powershell
claude mcp list
```

В списке должен появиться сервер `aitasker`.

## Правильный сценарий планирования

Теперь правильный flow такой:

1. Ты создаешь задачу в AITasker.
2. В Claude Code просишь распланировать ее.
3. Claude Code через MCP:
   - находит задачу
   - читает задачу
   - при необходимости читает текущий план
   - генерирует Markdown
   - сохраняет план через `save_plan`
4. План появляется в AITasker и доступен для ручного редактирования.

Пример запроса в Claude Code:

```text
Найди в aitasker задачу "Сделать onboarding экран", распланируй ее и сохрани план обратно через MCP.
```

Или точнее, по id:

```text
Распланируй в aitasker задачу с id 12345678-1234-1234-1234-123456789abc и сохрани план обратно через MCP.
```

## Что должен сделать внешний агент

Для команды вроде `распланируй задачу X` внешний агент должен пройти такую цепочку:

1. `find_tasks` или `list_tasks`
2. `get_task`
3. при необходимости `get_plan`
4. сформировать Markdown в формате плана
5. `save_plan`

Формат плана:

```md
# План задачи

## Цель
...

## Контекст
...

## Шаги
1. ...
2. ...
3. ...

## Открытые вопросы
- ...

## Критерии готовности
- ...
```

## Prompt для MCP-клиента

Сервер отдает prompt `plan_task`.

Его назначение:

- принять `taskRef`
- найти нужную задачу
- прочитать ее контекст
- собрать план
- сохранить план обратно в AITasker

Если клиент умеет использовать MCP prompts, лучше использовать именно `plan_task`.
Если нет, обычный natural-language запрос тоже подойдет, потому что все нужные tools уже открыты.

## Что изменилось относительно старого подхода

Удалено:

- внутреннее планирование через SDK
- вызовы Anthropic/OpenAI из main process
- зависимость от API-ключей для генерации плана внутри приложения

Осталось:

- локальная БД
- MCP server
- ручное редактирование Markdown
- внешний агент как единственный способ автоматического планирования

## Ограничение окружения

В этой Windows-среде все еще может оставаться отдельная проблема с Electron bootstrap на импорте `electron/main`. Это не связано с MCP-архитектурой, но может мешать локальному запуску окна приложения.
