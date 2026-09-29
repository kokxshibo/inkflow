#!/usr/bin/env bash
#
# Première installation d'InkFlow sur le VPS (relançable sans risque).
#
#   sudo bash deploy/setup-vps.sh inkflow.51-83-74-6.sslip.io
#
# Crée l'utilisateur système, la base PostgreSQL, le fichier de configuration
# avec des secrets générés sur place, les services systemd et le site nginx,
# puis demande le certificat HTTPS. Le code lui-même est installé ensuite par
# deploy/deploy.sh (depuis ton PC).
set -euo pipefail

DOMAIN="${1:?Usage : sudo bash setup-vps.sh <domaine>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE=/opt/inkflow/inkflow.env

# ── Utilisateur et dossiers ──────────────────────────────────────────────
id inkflow &>/dev/null ||
    useradd --system --home-dir /var/lib/inkflow --shell /usr/sbin/nologin inkflow
install -d -m 755 /opt/inkflow /opt/inkflow/releases
# 755 : nginx (www-data) doit pouvoir lire les fichiers envoyés.
install -d -m 755 -o inkflow -g inkflow /var/lib/inkflow /var/lib/inkflow/uploads
install -d -m 750 -o inkflow -g inkflow /var/lib/inkflow/cache
install -d -m 700 /opt/sauvegardes/inkflow

# ── Base de données et secrets (une seule fois) ──────────────────────────
if [ ! -f "$ENV_FILE" ]; then
    DB_PASSWORD="$(openssl rand -hex 24)"
    if sudo -u postgres psql -Atc "SELECT 1 FROM pg_roles WHERE rolname = 'inkflow'" | grep -q 1; then
        sudo -u postgres psql -v ON_ERROR_STOP=1 -qc "ALTER ROLE inkflow WITH LOGIN PASSWORD '$DB_PASSWORD'"
    else
        sudo -u postgres psql -v ON_ERROR_STOP=1 -qc "CREATE ROLE inkflow WITH LOGIN PASSWORD '$DB_PASSWORD'"
    fi
    if ! sudo -u postgres psql -Atc "SELECT 1 FROM pg_database WHERE datname = 'inkflow'" | grep -q 1; then
        sudo -u postgres psql -v ON_ERROR_STOP=1 -qc \
            "CREATE DATABASE inkflow OWNER inkflow ENCODING 'UTF8' TEMPLATE template0"
    fi

    # Format CLE=valeur sans guillemets : lu par systemd et par le script de build.
    umask 027
    cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgresql://inkflow:$DB_PASSWORD@127.0.0.1:5432/inkflow
AUTH_SECRET=$(openssl rand -hex 32)
APP_URL=https://$DOMAIN
CRON_SECRET=$(openssl rand -hex 32)
SETUP_TOKEN=$(openssl rand -hex 16)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
EOF
    chown root:inkflow "$ENV_FILE"
    chmod 640 "$ENV_FILE"
    echo "Configuration créée : $ENV_FILE"
fi

# ── Services systemd ─────────────────────────────────────────────────────
install -m 644 "$HERE/inkflow.service" "$HERE/inkflow-sync.service" "$HERE/inkflow-sync.timer" \
    "$HERE/inkflow-backup.service" "$HERE/inkflow-backup.timer" /etc/systemd/system/
install -m 755 "$HERE/inkflow-backup" /usr/local/bin/inkflow-backup
systemctl daemon-reload
systemctl enable inkflow.service inkflow-sync.timer
# La relève démarre au premier déploiement ; la sauvegarde, tout de suite.
systemctl enable --now inkflow-backup.timer

# ── nginx + HTTPS ────────────────────────────────────────────────────────
SITE="/etc/nginx/sites-available/$DOMAIN"
if [ ! -f "$SITE" ]; then
    sed "s/__DOMAIN__/$DOMAIN/g" "$HERE/nginx.conf" > "$SITE"
    ln -sfn "$SITE" "/etc/nginx/sites-enabled/$DOMAIN"
    nginx -t
    systemctl reload nginx
fi
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --redirect
fi

echo "Installation prête. Déploie maintenant le code avec deploy/deploy.sh."
