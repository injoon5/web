#!/bin/bash

set -euo pipefail

SCRIPT_VERSION="${1:-v0.0.1}"
VERSION_PATH="${2:-/usr/local/bin/install-fonts-and-fontconfig.sh.version}"

if [ -f "${VERSION_PATH}" ] && [ "$(tr -d '\n\r' < "${VERSION_PATH}")" = "${SCRIPT_VERSION}" ]; then
    echo "Font download/config already installed at ${SCRIPT_VERSION}, skipping"
    exit 0
fi

CASCADIA_ZIP="/usr/local/share/cloud-agent-media/CascadiaCode-2008.25.zip"
CASCADIA_TMP_DIR="/tmp/cascadia"
CASCADIA_DEST_DIR="/usr/share/fonts/truetype/cascadia"
FONTCONFIG_PATH="/etc/fonts/local.conf"

mkdir -p "${CASCADIA_DEST_DIR}"
mkdir -p "${CASCADIA_TMP_DIR}"

if [ ! -f "${CASCADIA_ZIP}" ]; then
    echo "ERROR: bundled Cascadia archive missing at ${CASCADIA_ZIP}" >&2
    exit 1
fi

python3 - "${CASCADIA_ZIP}" "${CASCADIA_TMP_DIR}" <<'PY'
import sys
import zipfile

zip_path, dest_dir = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(zip_path) as archive:
    archive.extractall(dest_dir)
PY

find "${CASCADIA_TMP_DIR}/ttf" -maxdepth 1 -type f -name '*.ttf' -exec install -m 0644 -t "${CASCADIA_DEST_DIR}" {} +
rm -rf "${CASCADIA_TMP_DIR}"

cat > "${FONTCONFIG_PATH}" <<'EOF'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <match><test name="family" compare="eq"><string>Arial</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Arimo</string></edit>
  </match>
  <match><test name="family" compare="eq"><string>Arial Unicode MS</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Arimo</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Helvetica</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Liberation Sans</string></edit>
  </match>
  <match><test name="family" compare="eq"><string>Helvetica Neue</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Liberation Sans</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>.SF NS</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Inter</string></edit>
    <edit name="family" mode="append_last" binding="strong"><string>Public Sans</string></edit>
  </match>
  <match><test name="family" compare="eq"><string>.SF NS Bold</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Inter</string></edit>
    <edit name="style" mode="assign" binding="strong"><string>Bold</string></edit>
    <edit name="family" mode="append_last" binding="strong"><string>Public Sans</string></edit>
  </match>
  <match><test name="family" compare="eq"><string>Inter</string></test>
    <edit name="family" mode="append_last" binding="strong"><string>Public Sans</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Lucida Grande</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Source Sans 3</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Times New Roman</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Tinos</string></edit>
  </match>
  <match><test name="family" compare="eq"><string>Times</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Tinos</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Courier New</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Cousine</string></edit>
  </match>
  <match><test name="family" compare="eq"><string>Courier</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Cousine</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Gill Sans</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Cantarell</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Menlo</string></test>
    <edit name="family" mode="assign" binding="strong"><string>JetBrains Mono</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Monaco</string></test>
    <edit name="family" mode="assign" binding="strong"><string>JetBrains Mono</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>.SF NS Mono</string></test>
    <edit name="family" mode="assign" binding="strong"><string>JetBrains Mono</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>system-ui</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Noto Sans</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>-apple-system</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Noto Sans</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>BlinkMacSystemFont</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Noto Sans</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Segoe UI</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Noto Sans</string></edit>
  </match>

  <match><test name="family" compare="eq"><string>Roboto</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Noto Sans</string></edit>
  </match>
</fontconfig>
EOF

fc-cache --really-force --verbose

mkdir -p "$(dirname "${VERSION_PATH}")"
printf '%s\n' "${SCRIPT_VERSION}" > "${VERSION_PATH}"

echo "Installed font download/config setup at ${SCRIPT_VERSION}"
