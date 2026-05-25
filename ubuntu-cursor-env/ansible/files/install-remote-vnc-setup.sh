#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install-remote-vnc-setup.sh.version}"
NOVNC_VERSION="${3:-1.2.0}"
WEBSOCKIFY_VERSION="${4:-0.10.0}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Remote VNC setup already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

NOVNC_DIR="/usr/local/novnc"
NOVNC_BUNDLED_ZIP_PATH="/usr/local/share/cloud-agent-media/noVNC-${NOVNC_VERSION}.zip"
NOVNC_SOURCE_DIR="${NOVNC_DIR}/noVNC-${NOVNC_VERSION}"
NOVNC_INDEX_PATH="${NOVNC_SOURCE_DIR}/index.html"
NOVNC_HTML_PATH="${NOVNC_SOURCE_DIR}/vnc.html"
WEBSOCKIFY_BUNDLED_ZIP_PATH="/usr/local/share/cloud-agent-media/websockify-${WEBSOCKIFY_VERSION}.zip"
WEBSOCKIFY_SOURCE_DIR="${NOVNC_DIR}/websockify-${WEBSOCKIFY_VERSION}"
WEBSOCKIFY_LINK_PATH="${NOVNC_SOURCE_DIR}/utils/websockify"
WEBSOCKIFY_RUN_PATH="${WEBSOCKIFY_SOURCE_DIR}/run"

mkdir -p "${NOVNC_DIR}"

if [ ! -f "${NOVNC_BUNDLED_ZIP_PATH}" ]; then
    echo "ERROR: bundled noVNC archive missing at ${NOVNC_BUNDLED_ZIP_PATH}" >&2
    exit 1
fi

python3 - "${NOVNC_BUNDLED_ZIP_PATH}" "${NOVNC_DIR}" <<'PY'
import sys
import zipfile

zip_path, dest_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as archive:
    archive.extractall(dest_dir)
PY

install -m 0644 "${NOVNC_HTML_PATH}" "${NOVNC_INDEX_PATH}"

if [ ! -f "${WEBSOCKIFY_BUNDLED_ZIP_PATH}" ]; then
    echo "ERROR: bundled websockify archive missing at ${WEBSOCKIFY_BUNDLED_ZIP_PATH}" >&2
    exit 1
fi

python3 - "${WEBSOCKIFY_BUNDLED_ZIP_PATH}" "${NOVNC_DIR}" <<'PY'
import sys
import zipfile

zip_path, dest_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as archive:
    archive.extractall(dest_dir)
PY

ln -sfn "${WEBSOCKIFY_SOURCE_DIR}" "${WEBSOCKIFY_LINK_PATH}"

chmod 0755 "${NOVNC_SOURCE_DIR}/utils/launch.sh"
# Ensure the launcher is always a valid executable script. Some zip extraction
# paths can flatten symlinks into plain text files, which breaks noVNC launch.
cat > "${WEBSOCKIFY_RUN_PATH}" <<'RUNSCRIPT'
#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"
exec python3 -m websockify "$@"
RUNSCRIPT
chmod 0755 "${WEBSOCKIFY_RUN_PATH}"

mkdir -p /var/run/dbus
chmod 0755 /var/run/dbus

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Installed remote VNC setup at ${SCRIPT_VERSION}"
