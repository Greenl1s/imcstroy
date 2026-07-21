#!/bin/sh
# Поднимает лимит размера файла в OnlyOffice с 100 МБ (по умолчанию) до 500 МБ.
# Выполняется при КАЖДОМ запуске контейнера — поэтому переживает пересоздание
# и обновление образа, в отличие от разовой ручной правки внутри контейнера.
#
# Правим default.json точечно (меняем только число), а не создаём свой
# local.json — создание local.json конфликтовало с тем, как сам OnlyOffice
# записывает туда настройки JWT при старте, и документы переставали
# открываться с ошибкой "неправильный формат токена".
set -e

CONF=/etc/onlyoffice/documentserver/nginx/includes/ds-common.conf

# Внутренний nginx самого OnlyOffice — свой собственный лимит,
# не имеет отношения к нашему Caddy снаружи.
if [ -f "$CONF" ] && ! grep -q "client_max_body_size 500m" "$CONF"; then
  sed -i 's/client_max_body_size [0-9]*m;/client_max_body_size 500m;/' "$CONF"
fi

# Точечная правка числа прямо в default.json — без замены всего файла.
# Безопасно повторять при каждом запуске, поэтому переживает обновление образа.
DEFAULT_JSON=/etc/onlyoffice/documentserver/default.json
if [ -f "$DEFAULT_JSON" ]; then
  sed -i 's/"limits_tempfile_upload": *[0-9]*/"limits_tempfile_upload": 524288000/' "$DEFAULT_JSON"
fi

exec /app/ds/run-document-server.sh "$@"

