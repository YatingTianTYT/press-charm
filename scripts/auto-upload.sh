#!/bin/bash
# Press Charm Auto-Upload Script
# Watches ~/Pictures/PressCharm/new/ for new images
# Automatically: uploads → AI listing → hand model → publish

# === CONFIG ===
WATCH_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/PressCharm/new"
DONE_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/PressCharm/done"
SITE_URL="${PRESS_CHARM_URL:-http://localhost:3000}"
ADMIN_PASSWORD="${PRESS_CHARM_PASSWORD:-presscharm2024}"

# Create directories if they don't exist
mkdir -p "$WATCH_DIR" "$DONE_DIR"

# Login and get session cookie
login() {
  COOKIE_FILE=$(mktemp)
  curl -s -c "$COOKIE_FILE" -X POST "$SITE_URL/api/admin/auth" \
    -H "Content-Type: application/json" \
    -d "{\"password\": \"$ADMIN_PASSWORD\"}" > /dev/null
  echo "$COOKIE_FILE"
}

# Process a single image
process_image() {
  local FILE="$1"
  local COOKIE_FILE="$2"
  local FILENAME=$(basename "$FILE")

  echo "[$(date '+%H:%M:%S')] Processing: $FILENAME"

  # Step 1: Upload + AI listing
  echo "  → Uploading & generating AI listing..."
  RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$SITE_URL/api/admin/auto-upload" \
    -F "file=@$FILE")

  PRODUCT_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['id'])" 2>/dev/null)

  if [ -z "$PRODUCT_ID" ]; then
    echo "  ✗ Failed to create product"
    return 1
  fi

  PRODUCT_NAME=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['product']['name'])" 2>/dev/null)
  echo "  → Created: $PRODUCT_NAME (ID: $PRODUCT_ID)"

  # Step 2: Generate hand model image
  echo "  → Generating hand model image..."
  HAND_RESPONSE=$(curl -s -b "$COOKIE_FILE" -X POST "$SITE_URL/api/admin/generate-hand-image" \
    -H "Content-Type: application/json" \
    -d "{\"productId\": \"$PRODUCT_ID\"}")

  HAND_URL=$(echo "$HAND_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null)
  if [ -n "$HAND_URL" ]; then
    echo "  → Hand model image generated"
  else
    echo "  → Hand model skipped (Gemini unavailable or failed)"
  fi

  # Step 3: Publish
  echo "  → Publishing..."
  curl -s -b "$COOKIE_FILE" -X POST "$SITE_URL/api/admin/publish/$PRODUCT_ID" > /dev/null

  # Step 4: Move to done
  mv "$FILE" "$DONE_DIR/$FILENAME"

  echo "  ✓ Published: $PRODUCT_NAME"

  # macOS notification
  osascript -e "display notification \"$PRODUCT_NAME has been published!\" with title \"Press Charm\" sound name \"Glass\""
}

# === MAIN ===
echo "============================================"
echo "  Press Charm Auto-Upload"
echo "  Watching: $WATCH_DIR"
echo "  Site: $SITE_URL"
echo "============================================"

# Login
COOKIE_FILE=$(login)
echo "Logged in to admin."

# Process any existing images first
for FILE in "$WATCH_DIR"/*.{jpg,JPG,jpeg,JPEG,png,PNG,heic,HEIC}; do
  [ -f "$FILE" ] || continue
  process_image "$FILE" "$COOKIE_FILE"
done

# Watch for new images
echo "Waiting for new images..."
fswatch -0 "$WATCH_DIR" | while IFS= read -r -d '' EVENT; do
  # Only process image files
  case "$EVENT" in
    *.jpg|*.JPG|*.jpeg|*.JPEG|*.png|*.PNG|*.heic|*.HEIC)
      # Wait for iCloud sync to finish writing the file
      sleep 5
      if [ -f "$EVENT" ]; then
        process_image "$EVENT" "$COOKIE_FILE"
      fi
      ;;
  esac
done
