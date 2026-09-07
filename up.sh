#!/bin/sh
# Поднимает оба сервиса и базу для прогона проверок.
set -e
# Освобождаем порты. pkill по имени файла ненадёжен: процессы запускаются
# через setsid из разных каталогов, и часть переживала команду — новый
# сервер тогда молча падал на "порт занят", а проверки шли по старому.
pkill -f "node src/index.js" 2>/dev/null || true
pkill -f "node src/server.js" 2>/dev/null || true
sleep 2

export JWT_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export FILE_LINK_SECRET=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

cd /home/claude/uchet/server
DATABASE_URL="postgres://pribory@/uchet?host=/tmp&port=5433" \
ADMIN_PASSWORD=admin12345 PORT=4200 \
FILEMANAGER_INTERNAL_URL=http://localhost:4300 \
setsid node src/index.js > /tmp/uchet-api.log 2>&1 &

cd /home/claude/fm
DATA_ROOT=/tmp/fmdata PORT=4300 \
ONLYOFFICE_JWT_SECRET=cccccccccccccccccccccccccccccccc \
ONLYOFFICE_PUBLIC_URL=https://office.example \
PGHOST=/tmp PGPORT=5433 PGUSER=pribory PGDATABASE=uchet \
setsid node src/server.js > /tmp/fm4300.log 2>&1 &

# Статика фронтенда: та же папка web/, только адрес API подменён на
# локальный сервер — иначе браузер стучался бы на боевой /instruments/api.
rm -rf /tmp/uchet-web && cp -r /home/claude/uchet/web /tmp/uchet-web
sed -i "s|window.API_BASE = '/instruments/api';|window.API_BASE = 'http://localhost:4200/api';|" /tmp/uchet-web/index.html
pkill -f "http.server 4400" 2>/dev/null || true
cd /tmp/uchet-web && setsid python3 -m http.server 4400 > /tmp/uchet-web.log 2>&1 &

sleep 5
echo "Учёт:  $(curl -s -o /dev/null -w '%{http_code}' localhost:4200/api/health)"
echo "Сайт:  $(curl -s -o /dev/null -w '%{http_code}' localhost:4400/index.html)"
echo "ИСУ:   $(curl -s -o /dev/null -w '%{http_code}' localhost:4300/)"
