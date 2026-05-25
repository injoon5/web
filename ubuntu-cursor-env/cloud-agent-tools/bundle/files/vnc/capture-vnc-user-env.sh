#!/bin/bash

set -euo pipefail

OUTPUT_PATH="${1:-/tmp/vnc-desktop-user-env}"

captured_user="${USER:-${USERNAME:-}}"
if [ -z "${captured_user}" ]; then
    captured_user="$(id -un)"
fi

captured_home="${HOME:-}"
if [ -z "${captured_home}" ]; then
    if command -v getent >/dev/null 2>&1; then
        captured_home="$(getent passwd "${captured_user}" | cut -d: -f6)"
    fi
    if [ -z "${captured_home}" ]; then
        if [ "${captured_user}" = "root" ]; then
            captured_home="/root"
        else
            captured_home="/home/${captured_user}"
        fi
    fi
fi

mkdir -p "$(dirname "${OUTPUT_PATH}")"
printf '%s\n%s\n' "${captured_user}" "${captured_home}" > "${OUTPUT_PATH}"
chmod 0600 "${OUTPUT_PATH}"

echo "Captured VNC user env for ${captured_user}"
