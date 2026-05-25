#!/usr/bin/env bash

set -euo pipefail

manifest_path="${1:-/packages/agent-controller/assets/media/manifest.json}"
media_root="${2:-/packages/agent-controller/assets/media}"

hash_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | cut -d' ' -f1
        return
    fi

    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | cut -d' ' -f1
        return
    fi

    echo "ERROR: sha256sum or shasum is required" >&2
    exit 1
}

if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is required to read ${manifest_path}" >&2
    exit 1
fi

asset_rows="$(jq -r '.assets[] | [.sourcePath, .destinationPath] | @tsv' "$manifest_path")"

if [ -n "$asset_rows" ]; then
    while IFS=$'\t' read -r source_path destination_path; do
        source_file="${media_root}/${source_path}"
        hash_path="${destination_path}.hash"

        if [ ! -f "$source_file" ]; then
            echo "ERROR: cloud agent media source asset missing at ${source_file}" >&2
            exit 1
        fi

        if [ ! -f "$destination_path" ]; then
            echo "ERROR: cloud agent media destination asset missing at ${destination_path}" >&2
            exit 1
        fi

        mkdir -p "$(dirname "$hash_path")"
        file_hash="$(hash_file "$source_file")"
        printf '%s' "$file_hash" > "$hash_path"
    done <<< "$asset_rows"
fi
