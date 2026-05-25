#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install_and_configure_themes.sh.version}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Themes already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

WHITESUR_GTK_ARCHIVE="/usr/local/share/cloud-agent-media/WhiteSur-Light.tar.xz"
WHITESUR_ICON_ARCHIVE="/usr/local/share/cloud-agent-media/WhiteSur-icon-theme-master.tar.gz"
WHITESUR_ICON_DIR="/tmp/WhiteSur-icon-theme-master"
WHITESUR_CURSOR_ARCHIVE="/usr/local/share/cloud-agent-media/WhiteSur-cursors-master.tar.gz"
WHITESUR_CURSOR_DIR="/tmp/WhiteSur-cursors-master"

mkdir -p /usr/share/themes

if [ ! -f "${WHITESUR_GTK_ARCHIVE}" ]; then
    echo "ERROR: bundled WhiteSur GTK archive missing at ${WHITESUR_GTK_ARCHIVE}" >&2
    exit 1
fi
tar -xJf "${WHITESUR_GTK_ARCHIVE}" -C /usr/share/themes

mkdir -p /usr/share/plank/themes/WhiteSur-Light
install -m 0644 "/usr/share/themes/WhiteSur-Light/plank/dock.theme" "/usr/share/plank/themes/WhiteSur-Light/dock.theme"

if [ ! -f "${WHITESUR_ICON_ARCHIVE}" ]; then
    echo "ERROR: bundled WhiteSur icon archive missing at ${WHITESUR_ICON_ARCHIVE}" >&2
    exit 1
fi
tar -xzf "${WHITESUR_ICON_ARCHIVE}" -C /tmp
(
    cd "${WHITESUR_ICON_DIR}"
    ./install.sh -d /usr/share/icons -b
)
rm -rf "${WHITESUR_ICON_DIR}"

if [ ! -f "${WHITESUR_CURSOR_ARCHIVE}" ]; then
    echo "ERROR: bundled WhiteSur cursor archive missing at ${WHITESUR_CURSOR_ARCHIVE}" >&2
    exit 1
fi
tar -xzf "${WHITESUR_CURSOR_ARCHIVE}" -C /tmp
(
    cd "${WHITESUR_CURSOR_DIR}"
    ./install.sh
)
rm -rf "${WHITESUR_CURSOR_DIR}"

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Installed themes at ${SCRIPT_VERSION}"
