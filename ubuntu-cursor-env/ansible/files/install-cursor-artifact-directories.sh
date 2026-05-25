#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install-cursor-artifact-directories.sh.version}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Cursor artifact directories already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

mkdir -p /opt/cursor /opt/cursor/artifacts /opt/cursor/recording-staging
chmod 777 /opt/cursor /opt/cursor/artifacts /opt/cursor/recording-staging

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Installed Cursor artifact directories at ${SCRIPT_VERSION}"
