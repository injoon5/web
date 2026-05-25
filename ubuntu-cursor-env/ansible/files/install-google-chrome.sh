#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install-google-chrome.sh.version}"
CLEANUP_MARKER_PATH="${3:-/tmp/vnc-desktop-apt-cleanup-needed}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Browser setup already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "ERROR: apt-get is not available on this VM; cannot install browser" >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

detect_deb_arch() {
    dpkg --print-architecture 2>/dev/null || uname -m
}

install_chromium_arm64() {
    local deb_arch="$1"
    echo "Installing Chromium for ${deb_arch} (Google Chrome deb is amd64-only)"

    rm -f /etc/apt/sources.list.d/google-chrome.list

    apt-get update
    if ! apt-get install -y --no-install-recommends chromium-browser 2>/dev/null; then
        apt-get install -y --no-install-recommends chromium
    fi

    local chromium_bin=""
    for candidate in /usr/bin/chromium-browser /usr/bin/chromium /snap/bin/chromium; do
        if [ -x "${candidate}" ]; then
            chromium_bin="${candidate}"
            break
        fi
    done
    if [ -z "${chromium_bin}" ]; then
        chromium_bin="$(command -v chromium-browser || command -v chromium || true)"
    fi
    if [ -z "${chromium_bin}" ] || [ ! -x "${chromium_bin}" ]; then
        echo "ERROR: Chromium binary not found after install" >&2
        exit 1
    fi

    ln -sf "${chromium_bin}" /usr/bin/google-chrome-stable
    ln -sf "${chromium_bin}" /usr/bin/google-chrome
    ln -sf "${chromium_bin}" /usr/bin/chrome

    local desktop_src=""
    for candidate in \
        /usr/share/applications/chromium-browser.desktop \
        /usr/share/applications/chromium.desktop; do
        if [ -f "${candidate}" ]; then
            desktop_src="${candidate}"
            break
        fi
    done

    if [ -n "${desktop_src}" ]; then
        install -m 0644 "${desktop_src}" /usr/share/applications/google-chrome.desktop
        sed -i \
            -e 's|chromium-browser|google-chrome-stable|g' \
            -e 's|/usr/bin/chromium-browser|/usr/bin/google-chrome-stable|g' \
            -e 's|/usr/bin/chromium |/usr/bin/google-chrome-stable |g' \
            -e 's|^Exec=chromium|Exec=/usr/bin/google-chrome-stable|g' \
            /usr/share/applications/google-chrome.desktop
    else
        cat > /usr/share/applications/google-chrome.desktop <<EOF
[Desktop Entry]
Version=1.0
Name=Google Chrome
Exec=/usr/bin/google-chrome-stable %U
Terminal=false
Icon=chromium-browser
Type=Application
Categories=Network;WebBrowser;
EOF
    fi

    echo "Installed Chromium as google-chrome-stable (${chromium_bin}) at ${SCRIPT_VERSION}"
}

install_google_chrome_amd64() {
    echo "Installing Google Chrome for amd64"

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

    echo "Installed Google Chrome at ${SCRIPT_VERSION}"
}

DEB_ARCH="$(detect_deb_arch)"
case "${DEB_ARCH}" in
    amd64|i386)
        install_google_chrome_amd64
        ;;
    arm64|armhf|aarch64)
        install_chromium_arm64 "${DEB_ARCH}"
        ;;
    *)
        echo "WARNING: unsupported architecture ${DEB_ARCH}; trying Chromium first" >&2
        if install_chromium_arm64 "${DEB_ARCH}" 2>/dev/null; then
            :
        else
            install_google_chrome_amd64
        fi
        ;;
esac

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"
touch "${CLEANUP_MARKER_PATH}"
