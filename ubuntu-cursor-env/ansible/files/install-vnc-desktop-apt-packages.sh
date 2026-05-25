#!/bin/bash

set -euo pipefail

APTFILE_PATH="${1:-/usr/local/share/vnc-desktop.Aptfile}"
VERSION_PATH="${2:-/usr/local/share/vnc-desktop.Aptfile.version}"
CLEANUP_MARKER_PATH="${3:-/tmp/vnc-desktop-apt-cleanup-needed}"
EXPECTED_APTFILE_VERSION="${4:-}"

if [ ! -f "${APTFILE_PATH}" ]; then
    echo "ERROR: VNC desktop Aptfile not found at ${APTFILE_PATH}" >&2
    exit 1
fi

if [ -n "${EXPECTED_APTFILE_VERSION}" ]; then
    aptfile_version="${EXPECTED_APTFILE_VERSION}"
else
    if ! command -v sha256sum >/dev/null 2>&1; then
        echo "ERROR: sha256sum is not available on this VM" >&2
        exit 1
    fi

    aptfile_version="$(sha256sum "${APTFILE_PATH}" | awk '{print $1}')"
fi

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${aptfile_version}" ]; then
    echo "VNC desktop apt packages already installed at ${aptfile_version}, skipping"
    exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: apt-get is not available on this VM; cannot install VNC desktop apt packages" >&2
    exit 1
fi

mapfile -t packages < <(sed -e 's/#.*//' -e '/^[[:space:]]*$/d' "${APTFILE_PATH}")

if [ "${#packages[@]}" -eq 0 ]; then
    echo "ERROR: no apt packages found in ${APTFILE_PATH}" >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends "${packages[@]}"

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${aptfile_version}" > "${VERSION_PATH}"
touch "${CLEANUP_MARKER_PATH}"

echo "Installed VNC desktop apt packages at ${aptfile_version}"
