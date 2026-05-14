#!/usr/bin/env bash
# ============================================================
# TightSpotHelper — pull-update.sh
# Run this from your repo root after downloading tightspothelper-final.zip
#
# Usage:
#   chmod +x pull-update.sh
#   ./pull-update.sh ~/Downloads/tightspothelper-final.zip
#
# Or with curl if you have a direct URL:
#   ./pull-update.sh https://your-url/tightspothelper-final.zip
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; exit 1; }

ZIP="${1:-}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo -e "\n${CYAN}${BOLD}  TightSpotHelper — Pull Update${NC}\n"

# ── 1. Get the zip ────────────────────────────────────────────
step "1/6 · Getting zip"

if [ -z "$ZIP" ]; then
  err "No zip provided.\nUsage: ./pull-update.sh /path/to/tightspothelper-final.zip"
fi

if [[ "$ZIP" == http* ]]; then
  echo "  Downloading from URL…"
  curl -fsSL "$ZIP" -o "$TMPDIR/update.zip"
  ZIP="$TMPDIR/update.zip"
  ok "Downloaded"
elif [ -f "$ZIP" ]; then
  ok "Using local zip: $ZIP"
else
  err "File not found: $ZIP"
fi

# ── 2. Verify we're in the repo root ─────────────────────────
step "2/6 · Verifying repo"

[ -f "package.json" ] || err "Not in repo root — cd into tightspothelper first"
[ -d ".git" ]         || err "No .git directory — is this a git repo?"

BRANCH=$(git branch --show-current)
ok "Repo: $(git remote get-url origin 2>/dev/null || echo 'unknown')"
ok "Branch: $BRANCH"

# ── 3. Extract and copy ───────────────────────────────────────
step "3/6 · Extracting and copying files"

unzip -q "$ZIP" -d "$TMPDIR/extracted"

# The zip always contains a tightspothelper/ root folder — strip it
SRC="$TMPDIR/extracted/tightspothelper"
[ -d "$SRC" ] || { SRC="$TMPDIR/extracted"; warn "No tightspothelper/ root found — using zip root"; }

# rsync is the cleanest way — preserves structure, overwrites changed files
if command -v rsync &>/dev/null; then
  rsync -a --exclude='.git' --exclude='node_modules' --exclude='.next' \
    "$SRC/" ./ 
  ok "Files synced via rsync"
else
  # Fallback: plain cp
  cp -r "$SRC"/. ./
  ok "Files copied via cp"
fi

# ── 4. Install new packages ───────────────────────────────────
step "4/6 · Installing npm packages"

# Check if new Stripe packages are needed
if grep -q "@stripe/react-stripe-js" package.json 2>/dev/null; then
  npm install --legacy-peer-deps 2>&1 | tail -3
  ok "npm install complete"
else
  ok "No new packages needed"
fi

# ── 5. New migrations ─────────────────────────────────────────
step "5/6 · Supabase migrations"

echo "  New migrations to apply:"
for f in supabase/migrations/004_rls_and_indexes.sql \
          supabase/migrations/005_realtime_and_policies.sql \
          supabase/migrations/006_storage_tracking.sql; do
  [ -f "$f" ] && echo "  ${CYAN}→${NC} $f"
done

if command -v supabase &>/dev/null; then
  supabase db push 2>&1 && ok "Migrations pushed via Supabase CLI" \
    || warn "CLI push failed — apply manually in Supabase SQL editor"
else
  echo ""
  echo "  ${YELLOW}Apply these in Supabase Dashboard → SQL Editor:${NC}"
  echo "  https://supabase.com/dashboard → your project → SQL Editor"
  echo ""
  for f in supabase/migrations/004_rls_and_indexes.sql \
            supabase/migrations/005_realtime_and_policies.sql \
            supabase/migrations/006_storage_tracking.sql; do
    [ -f "$f" ] && echo "  → $f"
  done
fi

# ── 6. Git commit and push ────────────────────────────────────
step "6/6 · Git commit and push"

git add -A

# Show what changed
CHANGED=$(git diff --cached --name-only | wc -l)
echo "  ${CHANGED} files changed:"
git diff --cached --name-only | sed 's/^/    /'

echo ""
read -p "  Commit message [feat: payment methods, Stripe elements, fee overrides, storage tracking]: " MSG
MSG="${MSG:-feat: payment methods, Stripe elements, fee overrides, storage tracking}"

git commit -m "$MSG"
git push origin "$BRANCH"

ok "Pushed to $BRANCH"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Done — Railway will auto-deploy in ~2 minutes${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  What to do next:"
echo ""
echo "  ${CYAN}1. Apply new migrations (if not auto-applied above):${NC}"
echo "     supabase/migrations/004_rls_and_indexes.sql"
echo "     supabase/migrations/005_realtime_and_policies.sql"
echo "     supabase/migrations/006_storage_tracking.sql"
echo ""
echo "  ${CYAN}2. Add your Stripe publishable key to Railway env:${NC}"
echo "     railway variables set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_..."
echo ""
echo "  ${CYAN}3. Create Stripe storage prices (if not done yet):${NC}"
echo "     node scripts/create-stripe-prices.js"
echo ""
echo "  ${CYAN}4. Add Stripe webhook events in dashboard:${NC}"
echo "     setup_intent.succeeded"
echo "     customer.subscription.created"
echo "     (+ all existing events)"
echo ""
echo "  ${CYAN}5. Watch Railway deploy:${NC}"
echo "     railway logs --tail"
echo ""
