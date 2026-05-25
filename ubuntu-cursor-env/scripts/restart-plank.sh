#!/bin/bash
# Restart Plank on a live AnyOS/VNC desktop without re-running desktop-init.
set -euo pipefail

USER_NAME="${VNC_USER:-ubuntu}"
DISPLAY="${DISPLAY:-:1}"

user_home="$(getent passwd "${USER_NAME}" | cut -d: -f6)"
dbus_file="$(ls -t "${user_home}/.dbus/session-bus"/* 2>/dev/null | head -1 || true)"
if [ -z "${dbus_file}" ] || [ ! -f "${dbus_file}" ]; then
    echo "No XFCE session D-Bus file under ${user_home}/.dbus/session-bus — is XFCE running?" >&2
    exit 1
fi
ADDR="$(grep '^DBUS_SESSION_BUS_ADDRESS=' "${dbus_file}" | head -1 | cut -d= -f2- | tr -d "'\"")"

run_user() {
    if [ "$(id -u)" -eq 0 ]; then
        sudo -u "${USER_NAME}" env \
            HOME="${user_home}" \
            USER="${USER_NAME}" \
            DISPLAY="${DISPLAY}" \
            DBUS_SESSION_BUS_ADDRESS="${ADDR}" \
            XDG_CURRENT_DESKTOP=XFCE \
            XDG_SESSION_TYPE=x11 \
            "$@"
    else
        env \
            HOME="${user_home}" \
            DISPLAY="${DISPLAY}" \
            DBUS_SESSION_BUS_ADDRESS="${ADDR}" \
            XDG_CURRENT_DESKTOP=XFCE \
            XDG_SESSION_TYPE=x11 \
            "$@"
    fi
}

pkill -u "${USER_NAME}" -x plank 2>/dev/null || true
if command -v bamfdaemon >/dev/null 2>&1; then
    pkill -u "${USER_NAME}" -x bamfdaemon 2>/dev/null || true
    run_user bamfdaemon >>/tmp/bamfdaemon.log 2>&1 &
    sleep 1
fi
run_user plank >>/tmp/plank.log 2>&1 &
sleep 1
if pgrep -u "${USER_NAME}" -x plank >/dev/null; then
    echo "Plank running (log: /tmp/plank.log)"
else
    echo "Plank failed to start — see /tmp/plank.log" >&2
    tail -20 /tmp/plank.log 2>/dev/null || true
    exit 1
fi
