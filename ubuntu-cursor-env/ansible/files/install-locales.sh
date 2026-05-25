#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install-locales.sh.version}"
LOCALE_GEN_PATH="/etc/locale.gen"
LOCALE_LINE="en_US.UTF-8 UTF-8"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Locale setup already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

if [ ! -f "${LOCALE_GEN_PATH}" ]; then
    echo "ERROR: locale configuration file not found at ${LOCALE_GEN_PATH}" >&2
    exit 1
fi

if ! grep -qxF "${LOCALE_LINE}" "${LOCALE_GEN_PATH}"; then
    printf '%s\n' "${LOCALE_LINE}" >> "${LOCALE_GEN_PATH}"
fi

locale-gen

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Configured locales at ${SCRIPT_VERSION}"
