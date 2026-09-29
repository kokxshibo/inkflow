#!/usr/bin/env bash
#
# Met en ligne sur le VPS la version commitée d'InkFlow (depuis ton PC, Git Bash) :
#
#   bash deploy/deploy.sh
#
# Variables facultatives : VPS (ubuntu@51.83.74.6) et SSH_KEY (~/.ssh/ovh-minecraft).
set -euo pipefail

VPS="${VPS:-ubuntu@51.83.74.6}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ovh-minecraft}"
cd "$(git rev-parse --show-toplevel)"

if [ -n "$(git status --porcelain)" ]; then
    echo "Attention : les modifications non commitées ne sont pas déployées."
fi

REVISION="$(git rev-parse --short HEAD)"
ARCHIVE="$(mktemp -d)/inkflow-$REVISION.tar.gz"
# Fins de ligne Unix quel que soit le réglage Git de Windows (core.autocrlf).
git -c core.autocrlf=false archive --format=tar.gz -o "$ARCHIVE" HEAD

echo "Envoi de la version $REVISION vers $VPS…"
scp -q -i "$SSH_KEY" "$ARCHIVE" "$VPS:/tmp/inkflow-src.tar.gz"
scp -q -i "$SSH_KEY" deploy/build-on-server.sh "$VPS:/tmp/inkflow-build-on-server.sh"
ssh -i "$SSH_KEY" "$VPS" \
    "sudo bash /tmp/inkflow-build-on-server.sh /tmp/inkflow-src.tar.gz; status=\$?; rm -f /tmp/inkflow-build-on-server.sh; exit \$status"
rm -f "$ARCHIVE"
