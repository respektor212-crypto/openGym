#!/usr/bin/env bash
# Personal build: put the exercise pictures (img/) and animations (gif/) next to the app, so the
# phone loads them from this site — same origin, cached by the service worker — instead of a CDN.
#
#   DATASET_REF=<commit> fork/fetch-media.sh frontend/dist
#
# Source: github.com/hasaneyldrm/exercises-dataset, at the commit upstream's own Pages demo pins.
# The media are third-party content, not covered by openGym's AGPL (see NOTICE.md). Like upstream's
# fetch-media.sh and docker compose, this downloads them at build time: they go into the published
# site only, never into this repository or its history.
set -euo pipefail
out="${1:?usage: fetch-media.sh <dist-dir>}"
ref="${DATASET_REF:?set DATASET_REF to a commit of hasaneyldrm/exercises-dataset}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Only images/ and videos/ are checked out; the dataset's 30 MB of JSON and HTML stay behind.
git clone -q --filter=blob:none --no-checkout https://github.com/hasaneyldrm/exercises-dataset.git "$tmp"
git -C "$tmp" sparse-checkout set --no-cone '/images/*.jpg' '/videos/*.gif'
git -C "$tmp" checkout -q "$ref"

mkdir -p "$out/img" "$out/gif"
cp "$tmp"/images/*.jpg "$out/img/"
cp "$tmp"/videos/*.gif "$out/gif/"

# Every file the app will ask for must be there: a renamed file in the dataset would otherwise
# only show up as blank tiles on the phone.
missing=0
for name in $(grep -oE '"(img|gif)":"[^"]+"' frontend/src/lib/exercises-data.js | sed -E 's/"(img|gif)":"([^"]+)"/\1\/\2/'); do
  [ -f "$out/$name" ] || { echo "missing: $name"; missing=$((missing + 1)); }
done
[ "$missing" -eq 0 ] || { echo "$missing media files missing"; exit 1; }
echo "✓ $(ls "$out/img" | wc -l) images, $(ls "$out/gif" | wc -l) GIFs, $(du -sh "$out/img" "$out/gif" | awk '{print $1}' | paste -sd+ -) "
