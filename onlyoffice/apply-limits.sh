#!/bin/sh
# Поднимает лимит размера файла в OnlyOffice с 100 МБ (по умолчанию) до 500 МБ.
# Выполняется при КАЖДОМ запуске контейнера — поэтому переживает пересоздание
# и обновление образа, в отличие от разовой ручной правки внутри контейнера.
set -e

CONF=/etc/onlyoffice/documentserver/nginx/includes/ds-common.conf

# Внутренний nginx самого OnlyOffice — свой собственный лимит,
# не имеет отношения к нашему Caddy снаружи.
if [ -f "$CONF" ] && ! grep -q "client_max_body_size 500m" "$CONF"; then
  sed -i 's/client_max_body_size [0-9]*m;/client_max_body_size 500m;/' "$CONF"
fi

# local.json — официально рекомендованный способ переопределить настройки
# из default.json, не трогая сам оригинальный файл.
cat > /etc/onlyoffice/documentserver/local.json << 'JSON'
{
  "services": {
    "CoAuthoring": {
      "server": {
        "limits_tempfile_upload": 524288000
      }
    }
  }
}
JSON

exec /app/ds/run-document-server.sh
