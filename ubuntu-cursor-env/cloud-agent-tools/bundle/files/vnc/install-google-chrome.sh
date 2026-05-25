#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install-google-chrome.sh.version}"
CLEANUP_MARKER_PATH="${3:-/tmp/vnc-desktop-apt-cleanup-needed}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Google Chrome setup already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: apt-get is not available on this VM; cannot install Google Chrome" >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# Bootstrap the tools needed to add the Google Chrome apt repository.
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl gnupg

mkdir -p /etc/apt/keyrings
curl --retry 5 --retry-delay 2 --retry-all-errors -fsSL \
    https://dl.google.com/linux/linux_signing_key.pub | \
    gpg --dearmor --batch --yes -o /etc/apt/keyrings/google-linux-signing.gpg
chmod a+r /etc/apt/keyrings/google-linux-signing.gpg

cat > /etc/apt/sources.list.d/google-chrome.list <<'EOF'
deb [arch=amd64 signed-by=/etc/apt/keyrings/google-linux-signing.gpg] https://dl.google.com/linux/chrome/deb/ stable main
EOF

apt-get update
apt-get install -y --no-install-recommends google-chrome-stable

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"
touch "${CLEANUP_MARKER_PATH}"

echo "Installed Google Chrome setup at ${SCRIPT_VERSION}"
