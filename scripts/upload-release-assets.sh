#!/usr/bin/env bash
set -euo pipefail

release_id="${1:?release id is required}"
shift

if [[ "$#" -eq 0 ]]; then
  echo "at least one asset path is required" >&2
  exit 1
fi

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

for asset in "$@"; do
  if [[ ! -f "$asset" ]]; then
    echo "release asset not found: $asset" >&2
    exit 1
  fi
done

for asset in "$@"; do
  name="$(basename "$asset")"
  existing_id="$(ASSET_NAME="$name" gh api "repos/$repo/releases/$release_id/assets?per_page=100" \
    --jq 'map(select(.name == env.ASSET_NAME))[0].id // empty')"
  if [[ -n "$existing_id" ]]; then
    gh api "repos/$repo/releases/assets/$existing_id" --method DELETE
  fi

  encoded_name="$(jq -rn --arg value "$name" '$value | @uri')"
  gh api "https://uploads.github.com/repos/$repo/releases/$release_id/assets?name=$encoded_name" \
    --method POST \
    -H "Content-Type: application/octet-stream" \
    --input "$asset" >/dev/null
  echo "uploaded $name"
done
