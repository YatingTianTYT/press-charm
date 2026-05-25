#!/bin/bash
# Generate a printable QR label PDF for a product.
#
# Usage:
#   ./scripts/generate-qr-label.sh PRODUCT_ID [OUT_DIR]
#
# Requires: Chrome (headless), curl. Designed to run on macOS after the V3
# auto-upload pipeline succeeds. Drop the PDFs into
# ~/Pictures/PressCharm/qr-labels/ and print them in a batch on the weekend.

set -e

PRODUCT_ID="$1"
OUT_DIR="${2:-$HOME/Pictures/PressCharm/qr-labels}"
SITE_URL="${PRESS_CHARM_URL:-http://localhost:3000}"
ADMIN_PASSWORD="${PRESS_CHARM_PASSWORD:?Error: PRESS_CHARM_PASSWORD environment variable is required.}"

if [ -z "$PRODUCT_ID" ]; then
  echo "Usage: $0 PRODUCT_ID [OUT_DIR]"
  exit 1
fi

mkdir -p "$OUT_DIR"

# Login to get an admin session cookie
COOKIE_FILE=$(mktemp)
trap 'rm -f "$COOKIE_FILE"' EXIT

curl -s -c "$COOKIE_FILE" -X POST "$SITE_URL/api/admin/auth" \
  -H "Content-Type: application/json" \
  -d "{\"password\": \"$ADMIN_PASSWORD\"}" > /dev/null

# Save the rendered HTML to a temp file so headless Chrome can fetch it
# without re-auth (we use --user-data-dir + cookies trick below).
LABEL_URL="${SITE_URL}/api/admin/qr-label/${PRODUCT_ID}"
TMP_HTML=$(mktemp -t qr-label-XXXXXX.html)
curl -s -b "$COOKIE_FILE" "$LABEL_URL" -o "$TMP_HTML"

if [ ! -s "$TMP_HTML" ]; then
  echo "  ✗ Failed to fetch label HTML for $PRODUCT_ID"
  rm -f "$TMP_HTML"
  exit 1
fi

OUT_PDF="$OUT_DIR/${PRODUCT_ID}.pdf"

# Find Chrome
CHROME=""
for path in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
  if [ -x "$path" ]; then
    CHROME="$path"
    break
  fi
done

if [ -z "$CHROME" ]; then
  echo "  ✗ No Chrome/Chromium/Edge found. Open $LABEL_URL in browser and Cmd-P → Save as PDF."
  rm -f "$TMP_HTML"
  exit 1
fi

"$CHROME" \
  --headless \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="$OUT_PDF" \
  --virtual-time-budget=2000 \
  "file://$TMP_HTML" 2>/dev/null

rm -f "$TMP_HTML"

if [ -s "$OUT_PDF" ]; then
  echo "  ✓ QR label saved: $OUT_PDF"
else
  echo "  ✗ Failed to write $OUT_PDF"
  exit 1
fi
