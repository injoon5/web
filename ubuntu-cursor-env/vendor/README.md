# Vendored cloud-agent assets

This tree mirrors every file in `cloud-agent-assets.tsv` at the path it will occupy on disk after install.

**Clean installs use this directory** (`ASSET_INSTALL_MODE=offline` in `config.env`). No CDN access required if this folder is committed.

## Refresh from CDN

```bash
cd ubuntu-cursor-env
./scripts/download-vendor-assets.sh
```

Requires `curl` and the base URL in `config.env`:

`https://public-asphr-vm-daemon-bucket.s3.us-east-1.amazonaws.com/cloud-agent-assets`

## Contents

- 16 macOS UI fonts (Inter, JetBrains Mono, Public Sans, Source Sans 3)
- 4 Cursor logo files (SVG + PNG)
- 6 theme/VNC archives under `usr/local/share/cloud-agent-media/`
- 4 desktop wallpapers under `usr/share/backgrounds/`

Total: **31 files**, ~41 MB.
