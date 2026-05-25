#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/configure-google-chrome.sh.version}"
TARGET_USER_OVERRIDE="${3:-}"
CAPTURED_USER_ENV_PATH="${CAPTURED_USER_ENV_PATH:-/tmp/vnc-desktop-user-env}"

load_captured_target_env() {
    if [ ! -f "${CAPTURED_USER_ENV_PATH}" ]; then
        return
    fi

    local captured_lines=()
    mapfile -t captured_lines < "${CAPTURED_USER_ENV_PATH}"

    if [ "${#captured_lines[@]}" -ge 1 ] && [ -n "${captured_lines[0]}" ]; then
        export USER="${captured_lines[0]}"
        export USERNAME="${captured_lines[0]}"
    fi
    if [ "${#captured_lines[@]}" -ge 2 ] && [ -n "${captured_lines[1]}" ]; then
        export HOME="${captured_lines[1]}"
        export CAPTURED_TARGET_HOME_FROM_FILE=1
    fi
}

load_captured_target_env
TARGET_USER="${TARGET_USER_OVERRIDE:-${USER:-${USERNAME:-root}}}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Google Chrome configuration already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

if [ ! -x /usr/bin/google-chrome-stable ]; then
    echo "ERROR: Google Chrome is not installed; cannot apply Chrome configuration" >&2
    exit 1
fi

CHROME_DESKTOP_FILE="/usr/share/applications/google-chrome.desktop"
if ! id -u "${TARGET_USER}" >/dev/null 2>&1; then
    echo "ERROR: VNC user ${TARGET_USER} does not exist" >&2
    exit 1
fi

TARGET_GROUP="$(id -gn "${TARGET_USER}")"
TARGET_HOME="${HOME:-}"
if [ "${CAPTURED_TARGET_HOME_FROM_FILE:-0}" != "1" ] && [ "${TARGET_USER}" != "root" ] && [ "${TARGET_HOME}" = "/root" ]; then
    TARGET_HOME=""
fi
if [ -z "${TARGET_HOME}" ]; then
    if command -v getent >/dev/null 2>&1; then
        TARGET_HOME="$(getent passwd "${TARGET_USER}" | cut -d: -f6)"
    fi
    if [ -z "${TARGET_HOME}" ]; then
        if [ "${TARGET_USER}" = "root" ]; then
            TARGET_HOME="/root"
        else
            echo "ERROR: Home directory for VNC user ${TARGET_USER} could not be determined" >&2
            exit 1
        fi
    fi
fi
if [ ! -d "${TARGET_HOME}" ]; then
    echo "ERROR: Home directory does not exist for user ${TARGET_USER} at ${TARGET_HOME}" >&2
    exit 1
fi
export HOME="${TARGET_HOME}"
CHROME_PROFILE_DIR="${TARGET_HOME}/.config/google-chrome"
CHROME_PLAYWRIGHT_PROFILE_DIR="${TARGET_HOME}/.config/google-chrome-playwright"
CHROME_WRAPPER_FLAGS="--no-sandbox --test-type --disable-dev-shm-usage --use-gl=angle --use-angle=swiftshader-webgl --password-store=basic --no-first-run --no-default-browser-check --remote-debugging-port=9222 --user-data-dir=${CHROME_PROFILE_DIR} --class=google-chrome --window-size=1820,1100 --window-position=50,50"
ensure_dir() {
    local path="$1"
    local mode="$2"
    local owner="${3:-}"
    local group="${4:-}"
    mkdir -p "${path}"
    chmod "${mode}" "${path}"
    if [ -n "${owner}" ]; then
        chown "${owner}:${group}" "${path}"
    fi
}

write_file() {
    local path="$1"
    local mode="$2"
    local owner="${3:-}"
    local group="${4:-}"
    mkdir -p "$(dirname "${path}")"
    cat > "${path}"
    chmod "${mode}" "${path}"
    if [ -n "${owner}" ]; then
        chown "${owner}:${group}" "${path}"
    fi
}

write_local_state() {
    local path="$1"
    local owner="${2:-}"
    local group="${3:-}"
    write_file "${path}" 0644 "${owner}" "${group}" <<'EOF'
{
  "browser": {
    "default_browser_infobar_last_declined": "99999999999999999",
    "default_browser_setting_enabled": false
  },
  "protocol_handler": {
    "excluded_schemes": {}
  }
}
EOF
}

write_preferences() {
    local path="$1"
    local owner="${2:-}"
    local group="${3:-}"
    write_file "${path}" 0644 "${owner}" "${group}" <<'EOF'
{
  "browser": {
    "check_default_browser": false,
    "show_home_button": false
  },
  "distribution": {
    "import_bookmarks": false,
    "import_history": false,
    "import_search_engine": false,
    "make_chrome_default_for_user": false,
    "skip_first_run_ui": true,
    "suppress_first_run_bubble": true,
    "suppress_first_run_default_browser_prompt": true
  },
  "first_run_tabs": [],
  "profile": {
    "default_content_setting_values": {},
    "exit_type": "Normal"
  },
  "signin": {
    "allowed": false
  },
  "sync_promo": {
    "show_on_first_run_allowed": false
  }
}
EOF
}

if [ -f "${CHROME_DESKTOP_FILE}" ]; then
    patched_desktop_file="$(mktemp)"
    while IFS= read -r line || [ -n "${line}" ]; do
        if [[ "${line}" == *"Exec=/usr/bin/google-chrome-stable"* ]] && [[ "${line}" != *"Exec=/usr/bin/google-chrome-stable --no-sandbox"* ]]; then
            line="${line/Exec=\/usr\/bin\/google-chrome-stable/Exec=\/usr\/bin\/google-chrome-stable ${CHROME_WRAPPER_FLAGS}}"
        fi
        printf '%s\n' "${line}" >> "${patched_desktop_file}"
    done < "${CHROME_DESKTOP_FILE}"
    cp "${patched_desktop_file}" "${CHROME_DESKTOP_FILE}"
    rm -f "${patched_desktop_file}"
else
    echo "Chrome desktop file not found at ${CHROME_DESKTOP_FILE}, skipping desktop patch"
fi

write_file "/usr/local/bin/chrome" 0755 <<EOF
#!/bin/bash
# Use a fixed user-data-dir to ensure --remote-debugging-port is always respected
# (Chrome ignores this flag if joining an existing instance)
# --class=google-chrome forces WMClass so Plank dock recognizes this as the same app
# --use-gl=angle --use-angle=swiftshader-webgl enables software WebGL via SwiftShader
exec /usr/bin/google-chrome-stable ${CHROME_WRAPPER_FLAGS} "\$@"
EOF

write_file "/usr/local/bin/google-chrome" 0755 <<EOF
#!/bin/bash
# Use a fixed user-data-dir to ensure --remote-debugging-port is always respected
# (Chrome ignores this flag if joining an existing instance)
# --class=google-chrome forces WMClass so Plank dock recognizes this as the same app
# --use-gl=angle --use-angle=swiftshader-webgl enables software WebGL via SwiftShader
exec /usr/bin/google-chrome-stable ${CHROME_WRAPPER_FLAGS} "\$@"
EOF

if [ "${TARGET_USER}" = "root" ]; then
    ensure_dir "${CHROME_PROFILE_DIR}" 0755
    ensure_dir "${CHROME_PROFILE_DIR}/Default" 0755
    write_file "${CHROME_PROFILE_DIR}/First Run" 0644 <<'EOF'
EOF
    write_local_state "${CHROME_PROFILE_DIR}/Local State"
    write_preferences "${CHROME_PROFILE_DIR}/Default/Preferences"
else
    ensure_dir "${CHROME_PROFILE_DIR}" 0755 "${TARGET_USER}" "${TARGET_GROUP}"
    ensure_dir "${CHROME_PROFILE_DIR}/Default" 0755 "${TARGET_USER}" "${TARGET_GROUP}"
    write_file "${CHROME_PROFILE_DIR}/First Run" 0644 "${TARGET_USER}" "${TARGET_GROUP}" <<'EOF'
EOF
    write_local_state "${CHROME_PROFILE_DIR}/Local State" "${TARGET_USER}" "${TARGET_GROUP}"
    write_preferences "${CHROME_PROFILE_DIR}/Default/Preferences" "${TARGET_USER}" "${TARGET_GROUP}"

    ensure_dir "${CHROME_PLAYWRIGHT_PROFILE_DIR}" 0755 "${TARGET_USER}" "${TARGET_GROUP}"
    ensure_dir "${CHROME_PLAYWRIGHT_PROFILE_DIR}/Default" 0755 "${TARGET_USER}" "${TARGET_GROUP}"
    write_file "${CHROME_PLAYWRIGHT_PROFILE_DIR}/First Run" 0644 "${TARGET_USER}" "${TARGET_GROUP}" <<'EOF'
EOF
    write_local_state "${CHROME_PLAYWRIGHT_PROFILE_DIR}/Local State" "${TARGET_USER}" "${TARGET_GROUP}"
    write_preferences "${CHROME_PLAYWRIGHT_PROFILE_DIR}/Default/Preferences" "${TARGET_USER}" "${TARGET_GROUP}"

    # mkdir -p above may create ~/.config as root:root while only chown'ing leaf dirs
    # (google-chrome, ...). Follow-on install steps run as the devcontainer user and
    # need to create siblings (e.g. ~/.config/gh for gh auth).
    if [ -d "${TARGET_HOME}/.config" ]; then
        chown "${TARGET_USER}:${TARGET_GROUP}" "${TARGET_HOME}/.config"
    fi
fi

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Configured Google Chrome at ${SCRIPT_VERSION}"
