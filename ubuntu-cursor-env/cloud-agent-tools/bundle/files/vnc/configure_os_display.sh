#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/configure_os_display.sh.version}"
TARGET_USER_OVERRIDE="${3:-}"
ANYOS_DESKTOP_APPEARANCE="${4:-light}"
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
VNC_USER="${TARGET_USER_OVERRIDE:-${USER:-${USERNAME:-root}}}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "OS display configuration already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

populate_xfce_templates() {
    local target_dir="$1"

    mkdir -p "${target_dir}/.config/xfce4/terminal"
    mkdir -p "${target_dir}/.config/gtk-3.0"
    mkdir -p "${target_dir}/.config/xfce4/xfconf/xfce-perchannel-xml"
    mkdir -p "${target_dir}/.config/plank/dock1/launchers"

    cat > "${target_dir}/.Xresources" <<'EOF'
! AnyOS X Resources
Xft.dpi: ANYOS_DPI
Xft.antialias: 1
Xft.hinting: 1
Xft.hintstyle: hintslight
Xft.rgba: rgb
EOF

    cat > "${target_dir}/.config/xfce4/terminal/terminalrc" <<'EOF'
[Configuration]
FontName=ANYOS_TERMINAL_FONT_NAME ANYOS_TERMINAL_FONT_SIZE
MiscAlwaysShowTabs=FALSE
MiscBell=FALSE
MiscBordersDefault=TRUE
MiscCursorBlinks=FALSE
MiscCursorShape=TERMINAL_CURSOR_SHAPE_BLOCK
MiscDefaultGeometry=100x30
MiscInheritGeometry=FALSE
MiscMenubarDefault=TRUE
MiscMouseAutohide=FALSE
MiscMouseWheelZoom=TRUE
MiscToolbarDefault=FALSE
MiscConfirmClose=TRUE
MiscCycleTabs=TRUE
MiscTabCloseButtons=TRUE
MiscTabCloseMiddleClick=TRUE
MiscTabPosition=GTK_POS_TOP
MiscHighlightUrls=TRUE
ScrollingBar=TERMINAL_SCROLLBAR_NONE
TitleMode=TERMINAL_TITLE_REPLACE
ColorForeground=#000000
ColorBackground=#FFFFFF
ColorCursor=#7F7F7F
ColorPalette=#000000;#C00000;#00C000;#C0C000;#0000C0;#C000C0;#00C0C0;#C0C0C0;#404040;#FF0000;#00FF00;#FFFF00;#0000FF;#FF00FF;#00FFFF;#FFFFFF
EOF

    cat > "${target_dir}/.config/gtk-3.0/settings.ini" <<'EOF'
[Settings]
gtk-theme-name=WhiteSur-Light
gtk-icon-theme-name=WhiteSur
gtk-cursor-theme-name=WhiteSur-cursors
gtk-cursor-theme-size=ANYOS_CURSOR_SIZE
gtk-font-name=ANYOS_FONT_NAME ANYOS_FONT_SIZE
gtk-application-prefer-dark-theme=0
EOF

    cat > "${target_dir}/.config/gtk-3.0/gtk.css" <<'EOF'
.xfce4-panel,
window.xfce4-panel,
#XfcePanelWindow {
  color: #000000;
}

.xfce4-panel button,
.xfce4-panel label,
window.xfce4-panel button,
window.xfce4-panel label,
#XfcePanelWindow button,
#XfcePanelWindow label {
  color: #000000;
}

#clock-button label {
  color: #000000;
}
EOF

    cat > "${target_dir}/.config/gtk-3.0/gtk.dark.css" <<'EOF'
.xfce4-panel,
window.xfce4-panel,
#XfcePanelWindow {
  color: #edecec;
}

.xfce4-panel button,
.xfce4-panel label,
window.xfce4-panel button,
window.xfce4-panel label,
#XfcePanelWindow button,
#XfcePanelWindow label {
  color: #edecec;
}

#clock-button label {
  color: #edecec;
}
EOF

    cat > "${target_dir}/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfwm4" version="1.0">
  <property name="general" type="empty">
    <property name="theme" type="string" value="WhiteSur-Light"/>
    <property name="title_font" type="string" value="ANYOS_TITLE_FONT_NAME ANYOS_TITLE_FONT_SIZE"/>
    <property name="button_layout" type="string" value="CHM|O"/>
    <property name="title_alignment" type="string" value="center"/>
    <property name="use_compositing" type="bool" value="true"/>
    <property name="show_dock_shadow" type="bool" value="false"/>
    <property name="show_popup_shadow" type="bool" value="false"/>
    <property name="shadow_opacity" type="int" value="50"/>
    <property name="raise_on_click" type="bool" value="true"/>
    <property name="click_to_focus" type="bool" value="true"/>
  </property>
</channel>
EOF

    cat > "${target_dir}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-desktop" version="1.0">
  <property name="backdrop" type="empty">
    <property name="screen0" type="empty">
      <property name="monitorscreen" type="empty">
        <property name="workspace0" type="empty">
          <property name="image-style" type="int" value="5"/>
          <property name="last-image" type="string" value="/usr/share/backgrounds/macos-wallpaper.png"/>
        </property>
      </property>
      <property name="monitor0" type="empty">
        <property name="workspace0" type="empty">
          <property name="image-style" type="int" value="5"/>
          <property name="last-image" type="string" value="/usr/share/backgrounds/macos-wallpaper.png"/>
        </property>
      </property>
      <property name="monitorVNC-0" type="empty">
        <property name="workspace0" type="empty">
          <property name="image-style" type="int" value="5"/>
          <property name="last-image" type="string" value="/usr/share/backgrounds/macos-wallpaper.png"/>
        </property>
      </property>
    </property>
  </property>
  <property name="desktop-icons" type="empty">
    <property name="style" type="int" value="0"/>
  </property>
</channel>
EOF

    cat > "${target_dir}/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xsettings" version="1.0">
  <property name="Net" type="empty">
    <property name="ThemeName" type="string" value="WhiteSur-Light"/>
    <property name="IconThemeName" type="string" value="WhiteSur"/>
    <property name="EnableEventSounds" type="bool" value="false"/>
    <property name="EnableInputFeedbackSounds" type="bool" value="false"/>
  </property>
  <property name="Gtk" type="empty">
    <property name="FontName" type="string" value="ANYOS_FONT_NAME ANYOS_FONT_SIZE"/>
    <property name="CursorThemeName" type="string" value="WhiteSur-cursors"/>
    <property name="CursorThemeSize" type="int" value="ANYOS_CURSOR_SIZE"/>
  </property>
  <property name="Xft" type="empty">
    <property name="DPI" type="int" value="-1"/>
    <property name="Antialias" type="int" value="1"/>
    <property name="Hinting" type="int" value="1"/>
    <property name="HintStyle" type="string" value="hintslight"/>
    <property name="RGBA" type="string" value="rgb"/>
  </property>
</channel>
EOF

    cat > "${target_dir}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-panel" version="1.0">
  <property name="configver" type="int" value="2"/>
  <property name="panels" type="array">
    <value type="int" value="1"/>
    <property name="panel-1" type="empty">
      <property name="position" type="string" value="p=6;x=0;y=0"/>
      <property name="length" type="uint" value="100"/>
      <property name="position-locked" type="bool" value="true"/>
      <property name="size" type="uint" value="ANYOS_PANEL_HEIGHT"/>
      <property name="background-style" type="uint" value="0"/>
      <property name="enter-opacity" type="uint" value="100"/>
      <property name="leave-opacity" type="uint" value="100"/>
      <property name="plugin-ids" type="array">
        <value type="int" value="1"/>
        <value type="int" value="2"/>
        <value type="int" value="3"/>
        <value type="int" value="4"/>
        <value type="int" value="5"/>
      </property>
    </property>
  </property>
  <property name="plugins" type="empty">
    <property name="plugin-1" type="string" value="separator">
      <property name="style" type="uint" value="0"/>
    </property>
    <property name="plugin-2" type="string" value="applicationsmenu">
      <property name="show-button-title" type="bool" value="false"/>
      <property name="button-icon" type="string" value="cursor-logo"/>
      <property name="small" type="bool" value="false"/>
    </property>
    <property name="plugin-3" type="string" value="separator">
      <property name="expand" type="bool" value="true"/>
      <property name="style" type="uint" value="0"/>
    </property>
    <property name="plugin-4" type="string" value="clock">
      <property name="digital-format" type="string" value="%a %b %d  %l:%M %p"/>
      <property name="mode" type="uint" value="2"/>
    </property>
    <property name="plugin-5" type="string" value="separator">
      <property name="style" type="uint" value="0"/>
    </property>
  </property>
</channel>
EOF

    cat > "${target_dir}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.dark.xml" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<channel name="xfce4-panel" version="1.0">
  <property name="configver" type="int" value="2"/>
  <property name="panels" type="array">
    <value type="int" value="1"/>
    <property name="panel-1" type="empty">
      <property name="position" type="string" value="p=6;x=0;y=0"/>
      <property name="length" type="uint" value="100"/>
      <property name="position-locked" type="bool" value="true"/>
      <property name="size" type="uint" value="ANYOS_PANEL_HEIGHT"/>
      <property name="background-style" type="uint" value="0"/>
      <property name="enter-opacity" type="uint" value="100"/>
      <property name="leave-opacity" type="uint" value="100"/>
      <property name="plugin-ids" type="array">
        <value type="int" value="1"/>
        <value type="int" value="2"/>
        <value type="int" value="3"/>
        <value type="int" value="4"/>
        <value type="int" value="5"/>
      </property>
    </property>
  </property>
  <property name="plugins" type="empty">
    <property name="plugin-1" type="string" value="separator">
      <property name="style" type="uint" value="0"/>
    </property>
    <property name="plugin-2" type="string" value="applicationsmenu">
      <property name="show-button-title" type="bool" value="false"/>
      <property name="button-icon" type="string" value="cursor-logo-dark"/>
      <property name="small" type="bool" value="false"/>
    </property>
    <property name="plugin-3" type="string" value="separator">
      <property name="expand" type="bool" value="true"/>
      <property name="style" type="uint" value="0"/>
    </property>
    <property name="plugin-4" type="string" value="clock">
      <property name="digital-format" type="string" value="%a %b %d  %l:%M %p"/>
      <property name="mode" type="uint" value="2"/>
    </property>
    <property name="plugin-5" type="string" value="separator">
      <property name="style" type="uint" value="0"/>
    </property>
  </property>
</channel>
EOF

    cat > "${target_dir}/.config/plank/dock1/settings" <<'EOF'
[PlankDockPreferences]
CurrentWorkspaceOnly=false
IconSize=ANYOS_DOCK_ICON_SIZE
HideMode=0
UnhideDelay=0
HideDelay=500
Monitor=
DockItems=google-chrome.dockitem;;thunar.dockitem;;xfce4-terminal.dockitem
Position=3
Offset=0
Theme=WhiteSur-Light
Alignment=3
ItemsAlignment=3
LockItems=false
PressureReveal=false
PinnedOnly=false
AutoPinning=true
ShowDockItem=false
ZoomEnabled=true
ZoomPercent=150
EOF

    cat > "${target_dir}/.config/plank/dock1/launchers/xfce4-terminal.dockitem" <<'EOF'
[PlankDockItemPreferences]
Launcher=file:///usr/share/applications/xfce4-terminal.desktop
EOF

    cat > "${target_dir}/.config/plank/dock1/launchers/thunar.dockitem" <<'EOF'
[PlankDockItemPreferences]
Launcher=file:///usr/share/applications/thunar.desktop
EOF

    cat > "${target_dir}/.config/plank/dock1/launchers/google-chrome.dockitem" <<'EOF'
[PlankDockItemPreferences]
Launcher=file:///usr/share/applications/google-chrome.desktop
EOF
}

XFCE_TMP_DIR="/tmp/xfce-config-processed"
rm -rf "${XFCE_TMP_DIR}"
mkdir -p "${XFCE_TMP_DIR}"
populate_xfce_templates "${XFCE_TMP_DIR}"

case "${ANYOS_DESKTOP_APPEARANCE}" in
    light|dark) ;;
    *)
        echo "Invalid ANYOS_DESKTOP_APPEARANCE=${ANYOS_DESKTOP_APPEARANCE} (expected 'light' or 'dark')" >&2
        exit 1
        ;;
esac

if [ "${ANYOS_DESKTOP_APPEARANCE}" = "dark" ]; then
    install -m 0644 \
        "${XFCE_TMP_DIR}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.dark.xml" \
        "${XFCE_TMP_DIR}/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml"
    install -m 0644 \
        "${XFCE_TMP_DIR}/.config/gtk-3.0/gtk.dark.css" \
        "${XFCE_TMP_DIR}/.config/gtk-3.0/gtk.css"
fi

install -m 0644 /usr/local/share/anyos.conf /tmp/anyos.conf
install -m 0755 /usr/local/bin/anyos-setup /tmp/anyos-setup.sh
/tmp/anyos-setup.sh "${XFCE_TMP_DIR}"

if ! id -u "${VNC_USER}" >/dev/null 2>&1; then
    echo "ERROR: VNC user ${VNC_USER} does not exist" >&2
    exit 1
fi

USER_HOME="${HOME:-}"
if [ "${CAPTURED_TARGET_HOME_FROM_FILE:-0}" != "1" ] && [ "${VNC_USER}" != "root" ] && [ "${USER_HOME}" = "/root" ]; then
    USER_HOME=""
fi
if [ -z "${USER_HOME}" ]; then
    if command -v getent >/dev/null 2>&1; then
        USER_HOME="$(getent passwd "${VNC_USER}" | cut -d: -f6)"
    fi
    if [ -z "${USER_HOME}" ]; then
        if [ "${VNC_USER}" = "root" ]; then
            USER_HOME="/root"
        else
            echo "ERROR: Home directory for VNC user ${VNC_USER} could not be determined" >&2
            exit 1
        fi
    fi
fi
if [ ! -d "${USER_HOME}" ]; then
    echo "ERROR: Home directory does not exist for user ${VNC_USER} at ${USER_HOME}" >&2
    exit 1
fi

cp -a "${XFCE_TMP_DIR}/." /root/

if [ "${VNC_USER}" != "root" ]; then
    VNC_GROUP="$(id -gn "${VNC_USER}")"
    ORIGINAL_USER_HOME_OWNER="$(stat -c '%U' "${USER_HOME}")"
    ORIGINAL_USER_HOME_GROUP="$(stat -c '%G' "${USER_HOME}")"
    ORIGINAL_USER_HOME_MODE="$(stat -c '%a' "${USER_HOME}")"
    # Preserve file metadata but do not preserve root ownership from the temp
    # source tree. USER_HOME metadata is restored below as a safety net.
    cp -a "${XFCE_TMP_DIR}/." "${USER_HOME}/"

    for owned_path in \
        "${USER_HOME}/.config" \
        "${USER_HOME}/.config/xfce4" \
        "${USER_HOME}/.config/gtk-3.0" \
        "${USER_HOME}/.config/plank" \
        "${USER_HOME}/.Xresources"; do
        if [ -e "${owned_path}" ]; then
            chown -R "${VNC_USER}:${VNC_GROUP}" "${owned_path}"
        fi
    done

    # cp -a can mutate the owner/mode on USER_HOME itself; restore original
    # metadata so follow-on non-root install steps (e.g. git config --global)
    # can still write lockfiles under $HOME.
    chown "${ORIGINAL_USER_HOME_OWNER}:${ORIGINAL_USER_HOME_GROUP}" "${USER_HOME}"
    chmod "${ORIGINAL_USER_HOME_MODE}" "${USER_HOME}"
fi

rm -rf "${XFCE_TMP_DIR}" /tmp/anyos.conf /tmp/anyos-setup.sh

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Configured OS display at ${SCRIPT_VERSION}"
