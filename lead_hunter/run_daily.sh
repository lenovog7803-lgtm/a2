#!/bin/bash
# Запуск ежедневного сбора лидов А2 Group в 08:30
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export PYTHONPATH="/Users/egoraleksandrorvic/Downloads/a2-main"

cd /Users/egoraleksandrorvic/Downloads/a2-main/lead_hunter || exit 1
/Users/egoraleksandrorvic/Downloads/a2-main/backend/.venv/bin/python main.py daily >> harvest.log 2>&1
