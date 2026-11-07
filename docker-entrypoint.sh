#!/bin/sh
set -e
# Bağlanan disk root sahipliğinde gelebilir; yazılabilir yapıp uygulamayı yetkisiz kullanıcıyla başlat
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${DATA_DIR:-/app/data}"
  chown -R node:node "${DATA_DIR:-/app/data}"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
