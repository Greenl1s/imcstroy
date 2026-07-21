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

  # Второй, отдельный лимит: docx/xlsx/pptx — это ZIP-архивы внутри,
  # и есть ограничение на размер их РАСПАКОВАННОГО содержимого (защита
  # от "zip-бомб"). У xlsx он и так 300MB по умолчанию, а у docx/pptx/vsdx —
  # всего 50MB, поэтому большие Word-документы упирались именно в это.
  sed -i 's/"uncompressed": "50MB"/"uncompressed": "300MB"/g' "$DEFAULT_JSON"

  # Третий, отдельный лимит: сколько байт готов скачать сам механизм
  # конвертации при подготовке документа к открытию. По умолчанию 100 МБ.
  sed -i 's/"maxDownloadBytes": *[0-9]*/"maxDownloadBytes": 524288000/' "$DEFAULT_JSON"
fi

exec /app/ds/run-document-server.sh "$@"

