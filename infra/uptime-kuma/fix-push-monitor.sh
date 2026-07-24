#!/bin/bash
set -e
docker stop uptime-kuma
sudo sqlite3 /home/snookie/income-stack/uptime-kuma/data/kuma.db "UPDATE monitor SET url='https://status.upwatch.online/api/push/5pyQgQR1m8' WHERE id=2;"
sudo sqlite3 /home/snookie/income-stack/uptime-kuma/data/kuma.db "SELECT id, name, type, url, push_token FROM monitor WHERE id=2;"
docker start uptime-kuma
