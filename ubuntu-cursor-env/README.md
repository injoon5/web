# Ubuntu Cursor Cloud Agent environment

Reproduce the Cursor **Cloud Agent** VNC desktop on a clean Ubuntu 22.04+ machine.

## Start here

| Doc | Contents |
|-----|----------|
| **[INSTALL.md](INSTALL.md)** | Step-by-step install, verify, troubleshoot |
| **[docs/COMPONENTS.md](docs/COMPONENTS.md)** | Every component explained |
| [SYSTEM_PATHS.md](SYSTEM_PATHS.md) | Target paths on disk |
| [config.env](config.env) | CDN URL + install mode |

## One-command install

```bash
cd ubuntu-cursor-env
./scripts/preflight.sh
sudo ./config.sh
```

Defaults: **offline** assets from committed `vendor/` (no S3). Network still needed for `apt` and Google Chrome.

## Bundle layout

```text
ubuntu-cursor-env/
├── config.sh / config.env
├── vendor/cloud-agent-assets/   # 31 vendored files (~41 MB)
├── cloud-agent-tools/bundle/    # install scripts + TSV manifests
├── ansible/                     # vnc-desktop.yml + XFCE templates
├── cloud-agent-assets.urls.json # CDN URLs per asset
├── scripts/                     # preflight, download, verify
└── home-dot-cursor/             # optional ~/.cursor helpers
```

## Asset CDN

```text
https://public-asphr-vm-daemon-bucket.s3.us-east-1.amazonaws.com/cloud-agent-assets/{sha256}{suffix}
```

Maintainers refresh vendor: `./scripts/download-vendor-assets.sh`

## Cursor logos

Installed to `/usr/share/pixmaps/` and `/usr/share/icons/hicolor/24x24/apps/`.  
XFCE panel uses icon names `cursor-logo` / `cursor-logo-dark`.  
Verified by `scripts/verify-cursor-logos.sh` during install.

## Not included

`/exec-daemon` (runtime injection), full `~/.cursor/plugins` cache.
