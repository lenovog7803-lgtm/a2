#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Премиум CRM для логистики (Експо + FastAPI + MongoDB) на русском.
  Текущая задача: интеграция с Google Sheets (вариант А — одностороннее CRM -> Sheets) для трёх сущностей: заказы, клиенты, перевозчики.
  Также: заменить горизонтальные чипы периодов на дашборде на выпадающий список.

backend:
  - task: "Google Sheets sync — модуль и эндпоинты"
    implemented: true
    working: true
    file: "/app/backend/sheets_sync.py, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Создан модуль sheets_sync.py (gspread + Service Account). Добавлены эндпоинты POST /api/sync/sheets и GET /api/sync/sheets/status. Каждый CRUD для orders/clients/carriers вызывает фоновую пересинхронизацию через BackgroundTasks. На текущий момент Google Sheets API в проекте a2group-crm выключен — sync возвращает ok=false с сообщением (это ожидаемо, пока пользователь не включит API). Нужно проверить: 1) что эндпоинты не падают; 2) что обычные CRUD orders/clients/carriers/leads и dashboard продолжают работать без сбоев после добавления BackgroundTasks."
        -working: true
        -agent: "testing"
        -comment: "PASS. GET /api/sync/sheets/status → 200, body={ok:false, message:'Не запускалась', synced:{}}. POST /api/sync/sheets → 200, body={ok:true, message:'Синхронизация выполнена', synced:{orders:8, clients:5, carriers:5}, sheet_url:...}. Google Sheets API оказался уже включён, реальная синхронизация прошла успешно. В backend.err.log есть один старый traceback с PermissionError (до включения API) — это ожидаемо и обработано в коде (превращается в ok=false). После включения API новых traceback нет."
  - task: "CRUD endpoints с BackgroundTasks для авто-синка"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "make_crud helper расширен параметром sync_to_sheets. Все методы CRUD для clients/carriers получили background_tasks. Аналогично перевыпустили эндпоинты для orders. Никаких изменений во входных payload-ах. Проверить, что POST/PUT/DELETE для orders, clients, carriers по-прежнему 200 OK и возвращают корректные модели."
        -working: true
        -agent: "testing"
        -comment: "PASS — полный CRUD-цикл (POST/GET list/GET id/PUT/DELETE/GET id→404) для /api/clients, /api/carriers, /api/orders, /api/leads. Все 24 запроса вернули корректный статус и валидные Pydantic-модели. BackgroundTasks не сломали ни один эндпоинт, в логах нет traceback во время CRUD. Также проверен dashboard: GET /api/dashboard, ?period=all и ?period=2026-02 — все 200 OK, все ожидаемые поля присутствуют (total_revenue, total_cost, total_margin, profit, tax_rate, margin_percent, active_orders, delivered_orders, total_orders, unpaid_by_clients, owed_to_carriers, clients_count, carriers_count, leads_count, top_clients, debtors, creditors, status_breakdown, available_months). Проверка profit ≈ total_margin*0.8 проходит: 237000→189600 и 172000→137600."

frontend:
  - task: "Dashboard — выпадающий список периодов + блок Google Sheets"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/dashboard.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Заменили горизонтальный список периодов на компонент Picker (label: Период). Добавлен блок Google Sheets с кнопкой 'Синхронизировать сейчас', статусом и понятными подсказками при ошибках (не включён API / нет доступа к таблице). Скриншот подтверждает корректный рендер. Тестирование фронтенда — только по запросу пользователя."

metadata:
  created_by: "main_agent"
  version: "3.1"
  test_sequence: 3

test_plan:
  current_focus:
    - "Google Sheets sync — модуль и эндпоинты"
    - "CRUD endpoints с BackgroundTasks для авто-синка"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: |
      Реализована интеграция Google Sheets (вариант А — одностороннее CRM → Sheets).
      Sheet ID: 1G0vzuwRKMH6lqG2iZ8Mdub2zDkOG1ViBPrVQEq3rjtU
      Service account: crm-bot@a2group-crm.iam.gserviceaccount.com
      Google Sheets API в Google Cloud для проекта a2group-crm НЕ ВКЛЮЧЁН — пользователь должен включить вручную (https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=933326984944) и поделиться таблицей с сервис-аккаунтом.

      Тестирующему агенту: проверить, что
        - GET /api/sync/sheets/status возвращает корректный JSON со статусом (без 5xx).
        - POST /api/sync/sheets отвечает 200 (даже если ok=false — это допустимо пока API выключен; главное — не должно быть HTTP 500).
        - Регрессионная проверка CRUD: GET/POST/PUT/DELETE для /api/clients, /api/carriers, /api/orders продолжают работать корректно после добавления BackgroundTasks.
        - GET /api/dashboard?period=... отдаёт total_margin/profit/debtors/creditors как раньше.
