#!/usr/bin/env bash
#
# Register the Tildes Polka Typewriter native messaging host with Chrome/Chromium
# on Linux. Run this once after loading the extension. Linux only.
#
# Usage:
#   ./install.sh
#
# The extension's ID is pinned via the "key" field in manifest.json, so it's
# always the same and baked in below — no need to copy it from chrome://extensions.
#
# What it does:
#   1. Wraps volume_host.py in a launcher that finds python3 at runtime.
#   2. Writes the native messaging host manifest into the per-user host dir for
#      each Chrome/Chromium flavor found, pointing at that launcher.

set -euo pipefail

HOST_NAME="com.tildes.polka.volume"
EXT_ID="pobfpngnkpgomhfpoaboejanbikilhhe"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/${HOST_NAME}.json.template"
PY_HOST="$HERE/volume_host.py"
LAUNCHER="$HERE/volume_host.sh"

if [[ ! -f "$PY_HOST" ]]; then
  echo "error: $PY_HOST not found" >&2
  exit 1
fi

PYTHON="$(command -v python3 || true)"
if [[ -z "$PYTHON" ]]; then
  echo "error: python3 not found on PATH" >&2
  exit 1
fi

# A tiny launcher so the manifest can point at a stable executable regardless of
# where python3 lives. Chrome execs the "path" directly, so it must be runnable.
cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
exec "$PYTHON" "$PY_HOST"
EOF
chmod +x "$LAUNCHER" "$PY_HOST"

# Per-user native messaging host manifest directories for the common flavors.
HOST_DIRS=(
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
  "$HOME/.config/microsoft-edge/NativeMessagingHosts"
)

manifest_json="$(sed \
  -e "s#__HOST_PATH__#$LAUNCHER#" \
  -e "s#__EXT_ID__#$EXT_ID#" \
  "$TEMPLATE")"

installed_any=0
for dir in "${HOST_DIRS[@]}"; do
  parent="$(dirname "$dir")"
  # Only install for browsers that are actually present.
  [[ -d "$parent" ]] || continue
  mkdir -p "$dir"
  printf '%s\n' "$manifest_json" > "$dir/${HOST_NAME}.json"
  echo "installed: $dir/${HOST_NAME}.json"
  installed_any=1
done

if [[ "$installed_any" -eq 0 ]]; then
  echo "warning: no Chrome/Chromium config dir found under ~/.config" >&2
  echo "  the extension's manifest will be written nowhere; is the browser installed?" >&2
  exit 1
fi

echo
echo "Done. Extension ID: $EXT_ID"
echo "Open the extension popup, tick the checkbox, and click 'Test native host'."
