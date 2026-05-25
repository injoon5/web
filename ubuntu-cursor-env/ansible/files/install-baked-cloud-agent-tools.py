#!/usr/bin/env python3

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def file_suffix(source_path: str) -> str:
    filename = source_path.split("/")[-1]
    suffix_start = filename.rfind(".")
    return filename[suffix_start:] if suffix_start >= 0 else ""


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def deterministic_tar_gzip(staging_dir: Path, archive_path: Path) -> None:
    """Match packages/agent-controller/src/cloudAgentAssets.ts execDeterministicTarGzip."""
    args = [
        "--sort=name",
        "--mtime=@0",
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "-czf",
        str(archive_path),
        "-C",
        str(staging_dir),
        ".",
    ]
    env = {**os.environ, "GZIP": "-n"}
    for cmd in ("gtar", "tar"):
        try:
            subprocess.run([cmd, *args], check=True, env=env, capture_output=True)
            return
        except FileNotFoundError:
            continue
        except subprocess.CalledProcessError:
            continue
    raise SystemExit(
        "GNU tar is required to bake cloud agent tools (same as Node build). "
        "Install gnu-tar if needed."
    )


def main() -> int:
    if len(sys.argv) != 6:
        raise SystemExit(
            "Usage: install-baked-cloud-agent-tools.py <tools-manifest> <asset-manifest> <asset-root> <runner-path> <tools-root>"
        )

    tools_manifest_path = Path(sys.argv[1])
    asset_manifest_path = Path(sys.argv[2])
    asset_root = Path(sys.argv[3])
    runner_path = Path(sys.argv[4])
    tools_root = Path(sys.argv[5])
    current_dir = tools_root / "current"
    hash_path = tools_root / "current.bundle-hash"

    tools_manifest = read_json(tools_manifest_path)
    asset_manifest = read_json(asset_manifest_path)

    source_tools = tools_manifest.get("tools")
    if not isinstance(source_tools, list):
        raise SystemExit("Cloud agent tools manifest must contain a tools array")
    source_assets = asset_manifest.get("assets")
    if not isinstance(source_assets, list):
        raise SystemExit("Cloud agent asset manifest must contain an assets array")

    bundled_tools: list[dict[str, str]] = []
    for tool in source_tools:
        source_path = str(tool["sourcePath"])
        source_file = asset_root / source_path
        with source_file.open("rb") as handle:
            content_hash = sha256_bytes(handle.read())
        bundled_tools.append(
            {
                "sourcePath": source_path,
                "destinationPath": str(tool["destinationPath"]),
                "mode": str(tool["mode"]),
                "contentHash": content_hash,
                "bundlePath": f"files/{source_path}",
                "fileSuffix": file_suffix(source_path),
            }
        )

    tools_manifest_tsv = "\n".join(
        "\t".join(
            [
                tool["mode"],
                tool["contentHash"],
                base64.b64encode(tool["bundlePath"].encode("utf-8")).decode("ascii"),
                base64.b64encode(tool["destinationPath"].encode("utf-8")).decode(
                    "ascii"
                ),
            ]
        )
        for tool in bundled_tools
    )

    asset_manifest_tsv_rows: list[str] = []
    for asset in source_assets:
        source_path = str(asset["sourcePath"])
        source_file = asset_root / source_path
        with source_file.open("rb") as handle:
            content_hash = sha256_bytes(handle.read())
        asset_manifest_tsv_rows.append(
            "\t".join(
                [
                    str(asset["mode"]),
                    content_hash,
                    file_suffix(source_path),
                    base64.b64encode(
                        str(asset["destinationPath"]).encode("utf-8")
                    ).decode("ascii"),
                ]
            )
        )
    asset_manifest_tsv = "\n".join(asset_manifest_tsv_rows)

    if current_dir.is_symlink() or current_dir.is_file():
        current_dir.unlink()
    elif current_dir.exists():
        shutil.rmtree(current_dir)
    current_dir.mkdir(parents=True, exist_ok=True)
    current_dir.chmod(0o755)

    (current_dir / "cloud-agent-assets.tsv").write_text(
        asset_manifest_tsv + "\n", encoding="utf-8"
    )
    (current_dir / "cloud-agent-tools.tsv").write_text(
        tools_manifest_tsv + "\n", encoding="utf-8"
    )

    runner_destination = current_dir / "cloud-agent-setup"
    shutil.copy2(runner_path, runner_destination)
    runner_destination.chmod(0o755)

    for tool in bundled_tools:
        source_file = asset_root / tool["sourcePath"]
        destination_file = current_dir / tool["bundlePath"]
        destination_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, destination_file)
        if tool["mode"] == "0755":
            destination_file.chmod(0o755)
        else:
            destination_file.chmod(0o644)

        installed_destination = Path(tool["destinationPath"])
        if not installed_destination.exists():
            raise SystemExit(
                f"Expected baked tool destination missing at {installed_destination}"
            )
        installed_hash_path = Path(f"{tool['destinationPath']}.hash")
        installed_hash_path.parent.mkdir(parents=True, exist_ok=True)
        installed_hash_path.write_text(tool["contentHash"], encoding="utf-8")

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        archive_path = Path(tmp.name)
    try:
        deterministic_tar_gzip(current_dir, archive_path)
        bundle_hash = sha256_bytes(gzip.decompress(archive_path.read_bytes()))
    finally:
        archive_path.unlink(missing_ok=True)

    tools_root.mkdir(parents=True, exist_ok=True)
    hash_path.write_text(bundle_hash + "\n", encoding="utf-8")
    os.chmod(hash_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
