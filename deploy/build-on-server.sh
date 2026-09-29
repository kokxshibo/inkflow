#!/usr/bin/env bash
#
# Construit et installe une version d'InkFlow sur le VPS. Appelé par
# deploy/deploy.sh avec l'archive du code :
#
#   sudo bash build-on-server.sh /tmp/inkflow-src.tar.gz
#
# Seul le build autonome de Next (≈ 100 Mo) est gardé : les dépendances
# complètes nécessaires à la compilation sont supprimées à la fin.
set -euo pipefail

ARCHIVE="${1:?Usage : sudo bash build-on-server.sh <archive.tar.gz>}"
APP=/opt/inkflow
BUILD=/var/tmp/inkflow-build
RELEASE="$APP/releases/$(date +%Y%m%d-%H%M%S)"

cleanup() { rm -rf "$BUILD" "$ARCHIVE"; }
trap cleanup EXIT

# La compilation tourne sous l'utilisateur inkflow, jamais en root.
rm -rf "$BUILD"
install -d -o inkflow -g inkflow "$BUILD"
sudo -u inkflow tar -xzf "$ARCHIVE" -C "$BUILD"

as_inkflow() {
    # Variables du fichier de configuration ; caches (npm, Prisma) jetables,
    # dans le dossier de build supprimé à la fin.
    sudo -u inkflow bash -c "set -a; . $APP/inkflow.env; set +a; cd $BUILD;         export HOME=$BUILD XDG_CACHE_HOME=$BUILD/.cache npm_config_cache=$BUILD/.npm NEXT_TELEMETRY_DISABLED=1; $*"
}

echo "▸ Dépendances"
as_inkflow "nice -n 10 npm ci --include=dev --no-audit --no-fund --loglevel=error"

echo "▸ Base de données"
as_inkflow "npx prisma generate >/dev/null && npx prisma migrate deploy"

echo "▸ Compilation"
# Mémoire limitée et priorité basse : le serveur Minecraft ne doit pas ramer.
as_inkflow "NODE_OPTIONS=--max-old-space-size=1536 nice -n 10 npx next build"

echo "▸ Installation de $RELEASE"
install -d "$RELEASE"
cp -a "$BUILD/.next/standalone/." "$RELEASE/"
cp -a "$BUILD/.next/static" "$RELEASE/.next/static"
cp -a "$BUILD/public" "$RELEASE/public"
rm -rf "$RELEASE/public/uploads" "$RELEASE/.next/cache"
# Seul dossier où Next écrit à l'exécution : hors de la version installée.
ln -s /var/lib/inkflow/cache "$RELEASE/.next/cache"
chown -R root:root "$RELEASE"

ln -sfn "$RELEASE" "$APP/current.new"
mv -T "$APP/current.new" "$APP/current"
systemctl restart inkflow

echo "▸ Vérification"
for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null http://127.0.0.1:3010/login; then
        # On ne garde que les deux dernières versions (retour arrière possible).
        ls -1dt "$APP"/releases/* | tail -n +3 | xargs -r rm -rf
        systemctl start inkflow-sync.timer
        echo "InkFlow est en ligne ($(du -sh "$RELEASE" | cut -f1) installés)."
        exit 0
    fi
    sleep 1
done

echo "ECHEC : l'application ne répond pas. Journal : journalctl -u inkflow -n 50" >&2
exit 1
