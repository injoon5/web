#!/usr/bin/env bash
# Create /opt/cursor runtime directories present on cloud VMs (excluding exec-daemon binary).

set -euo pipefail

mkdir -p /opt/cursor/artifacts /opt/cursor/recording-staging /opt/cursor/logs
chmod 777 /opt/cursor/artifacts /opt/cursor/recording-staging /opt/cursor/logs 2>/dev/null || true

# exec-daemon is provisioned at container runtime (~200MB); leave a marker only.
mkdir -p /opt/cursor/.exec-daemon
if [ ! -f /opt/cursor/.exec-daemon/README ]; then
  cat > /opt/cursor/.exec-daemon/README <<'EOF'
exec-daemon is installed at runtime by the Cursor cloud agent controller, not by ubuntu-cursor-env.
Expected host path: /exec-daemon (gh, node, cursorsandbox, etc.)
EOF
fi

echo "Installed /opt/cursor/{artifacts,recording-staging,logs,.exec-daemon}"
