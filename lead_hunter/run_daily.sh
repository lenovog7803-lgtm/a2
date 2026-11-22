#!/bin/bash
# Запуск ежедневного сбора лидов А2 Group в 08:30
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:$PATH"
export PYTHONPATH="/Users/egoraleksandrorvic/Downloads/a2-main"

# Ждем интернет до 60 секунд после пробуждения Mac
for i in {1..12}; do
  if ping -c 1 -t 3 8.8.8.8 > /dev/null 2>&1; then
    break
  fi
  sleep 5
done

cd /Users/egoraleksandrorvic/Downloads/a2-main/lead_hunter || exit 1
/Users/egoraleksandrorvic/Downloads/a2-main/backend/.venv/bin/python main.py daily >> /Users/egoraleksandrorvic/Developer/a2_harvest.log 2>&1
