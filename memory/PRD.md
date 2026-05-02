# Premium Logistics CRM — PRD

## Overview
Mobile-first premium logistics CRM (Expo + FastAPI + MongoDB) for a freight forwarder/expeditor. Replaces an AppSheet+Google Sheets workflow with a native-feeling, dark "private banking" aesthetic in Russian. Single user, no integrations.

## User
Russian-speaking freight expeditor — finds carriers (trucks) for clients, tracks orders, payments, document movement, and a cold-call leads pipeline.

## Sections (5 tabs)
1. **Дашборд** — Hero revenue + margin (with %, profit/loss color), bento cards for receivables/payables, KPI tiles, status breakdown bars, top-5 clients ranked.
2. **Заявки** — Order cards with route (from→to), status badge, monospace margin, payment indicators (client paid / carrier paid). Filter chips by status. Tap to open detail (edit all fields, toggle payments, change status/docs, delete).
3. **Клиенты** — Avatar monogram, contact person, INN, payment terms; tap-to-call/email actions.
4. **Перевозчики** — Vehicle pills (Тент 20т 86м³), gold-star rating, plate tag, call button.
5. **Обзвон (Call base)** — Lead pipeline with status filters; "Стал клиентом" / "В работу" actions; call button; next-call date highlight.

## Backend (FastAPI / MongoDB)
- Endpoints: `/api/dashboard`, full CRUD for `/api/orders`, `/api/clients`, `/api/carriers`, `/api/leads`, plus `/api/seed`.
- Pydantic v2 models, UUID ids, ISO datetime strings, `_id` excluded from all responses.
- Auto-seed on startup with realistic Russian logistics data (5 clients, 5 carriers, 7 orders, 7 leads).

## Design system
- Dark "obsidian + gold" (#0A0A0C / #C0A062), profit #00E676, loss #FF3B30, warning #F59E0B
- Glassmorphism tab bar (BlurView)
- Lucide icons (1.6 stroke)
- 8pt grid, sharp 12–16px radii, uppercase tracked labels
- All interactive elements have testIDs for automation.

## Out of scope (deferred)
- Google Sheets sync, Apps Script document generation
- Auth (single user)
- AI parsing / OCR

## Smart business enhancement
The dashboard automatically surfaces **"Ожидается от клиентов"** and **"К оплате перевозчикам"** as cash-flow alerts, turning the CRM into an operational liquidity tool — the single most common pain point for freight expeditors who manage 10-100+ overlapping unpaid invoices.
