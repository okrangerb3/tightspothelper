#!/usr/bin/env bash
# ============================================================
# TightSpotHelper — setup.sh
# One-shot setup for dev and production environments.
#
# GITHUB COPILOT: After this script completes, review COPILOT.md
# for a comprehensive checklist covering every API route, page,
# DB table, RLS policy, and integration. Start with:
#   cat COPILOT.md
#
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; }
step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }

WARNINGS=(); TODOS=()
track_warn() { WARNINGS+=("$1"); warn "$1"; }
track_todo() { TODOS+=("$1"); }

# ─────────────────────────────────────────────────────────────
echo -e "\n${CYAN}${BOLD}  TightSpotHelper — Setup Script${NC}\n"

# ── 0. Prerequisites ──────────────────────────────────────────
step "0/11 · Checking prerequisites"
command -v node &>/dev/null && ok "Node.js $(node -v)" || { err "Node.js not found — https://nodejs.org"; exit 1; }
command -v npm  &>/dev/null && ok "npm $(npm -v)"       || { err "npm not found"; exit 1; }
command -v git  &>/dev/null && ok "git"                 || { err "git not found"; exit 1; }

SUPABASE_CLI=false; RAILWAY_CLI=false
command -v supabase &>/dev/null && { ok "Supabase CLI"; SUPABASE_CLI=true; } \
  || track_warn "Supabase CLI missing — brew install supabase/tap/supabase"
command -v railway  &>/dev/null && { ok "Railway CLI";  RAILWAY_CLI=true;  } \
  || track_warn "Railway CLI missing  — npm i -g @railway/cli"

# ── 1. Install dependencies ────────────────────────────────────
step "1/11 · Installing npm dependencies"
npm install --legacy-peer-deps && ok "Dependencies installed" || { err "npm install failed"; exit 1; }

# ── 2. Environment file ────────────────────────────────────────
step "2/11 · Environment setup"
[ -f .env.local ] && ok ".env.local exists" || { cp .env.example .env.local; ok "Created .env.local"; }

# Load env vars silently
set +u
export $(grep -v '^#' .env.local | grep -v '^$' | sed 's/[[:space:]]*$//' | xargs 2>/dev/null) || true
set -u

# ── 3. Validate required env vars ─────────────────────────────
step "3/11 · Validating environment variables"

declare -A REQUIRED=(
  ["NEXT_PUBLIC_SUPABASE_URL"]="Supabase → Settings → API → Project URL"
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]="Supabase → Settings → API → anon/public key"
  ["SUPABASE_SERVICE_ROLE_KEY"]="Supabase → Settings → API → service_role key (secret!)"
  ["STRIPE_SECRET_KEY"]="Stripe → Developers → API keys → Secret key"
  ["STRIPE_WEBHOOK_SECRET"]="Stripe → Developers → Webhooks → Signing secret"
  ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]="Stripe → Developers → API keys → Publishable key"
  ["DAILY_API_KEY"]="Daily.co → Developers → API keys"
  ["DAILY_WEBHOOK_SECRET"]="Daily.co → Developers → Webhooks → Signing secret"
  ["R2_ACCOUNT_ID"]="Cloudflare → Account → Account ID"
  ["R2_ACCESS_KEY_ID"]="Cloudflare → R2 → Manage API Tokens → Access Key ID"
  ["R2_SECRET_ACCESS_KEY"]="Cloudflare → R2 → Manage API Tokens → Secret Access Key"
  ["R2_BUCKET_NAME"]="Your R2 bucket name (e.g. tightspothelper-recordings)"
  ["RESEND_API_KEY"]="Resend → API Keys → Create API Key"
  ["RESEND_FROM_EMAIL"]="Verified sender (e.g. noreply@tightspothelper.com)"
  ["CRON_SECRET"]="Random secret — openssl rand -hex 32"
  ["NEXT_PUBLIC_APP_URL"]="App URL (https://tightspothelper.com)"
)

MISSING=0
for VAR in "${!REQUIRED[@]}"; do
  VAL="${!VAR:-}"
  if [ -z "$VAL" ]; then
    err "MISSING $VAR"
    echo "         ${CYAN}Where:${NC} ${REQUIRED[$VAR]}"
    MISSING=$((MISSING + 1))
  else
    ok "$VAR"
  fi
done

[ $MISSING -gt 0 ] && {
  track_warn "$MISSING env var(s) missing — some steps skipped"
  track_todo "Fill in all env vars in .env.local, then re-run: ./setup.sh"
}

# ── 4. Security audit ────────────────────────────────────────
step "4/11 · Security check — no secrets in client code"

LEAKED=false
for S in SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY DAILY_API_KEY R2_SECRET_ACCESS_KEY; do
  LEAK=$(grep -rn "$S" app/ --include="*.ts" --include="*.tsx" 2>/dev/null \
         | grep -v "api/" || true)
  [ -n "$LEAK" ] && { err "SECRET LEAKED IN CLIENT: $S\n$LEAK"; LEAKED=true; }
done
$LEAKED || ok "No secrets found in client-side code"

# Ensure server-only secrets don't have NEXT_PUBLIC_ prefix
for S in SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY DAILY_API_KEY; do
  grep -q "NEXT_PUBLIC_${S}" .env.example 2>/dev/null \
    && err "NEXT_PUBLIC_${S} must NOT have NEXT_PUBLIC_ prefix" || true
done
ok "NEXT_PUBLIC_ prefixes correct"

# ── 5. Cron secret ───────────────────────────────────────────
step "5/11 · Cron secret"
if [ -z "${CRON_SECRET:-}" ]; then
  GENERATED=$(openssl rand -hex 32 2>/dev/null \
    || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "  Generated: $GENERATED"
  echo "  → Add to .env.local: CRON_SECRET=$GENERATED"
  track_todo "Add CRON_SECRET=$GENERATED to .env.local and Railway"
else
  ok "CRON_SECRET is set"
fi

# ── 6. Supabase migrations ────────────────────────────────────
step "6/11 · Supabase database migrations"

MIGRATIONS=(
  "001_initial.sql         — All tables, enums, RLS seed, indexes, triggers"
  "002_auth_trigger.sql    — Auto-create profile row on user signup"
  "003_rpc_functions.sql   — increment_expert_sessions + extend_recording RPCs"
  "004_rls_and_indexes.sql — RLS policies, additional indexes, admin seed query"
)

if $SUPABASE_CLI && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  supabase db push 2>&1 && ok "All migrations applied via CLI" || {
    track_warn "CLI push failed — apply manually in Supabase SQL editor"
  }
else
  echo ""
  echo "  ${YELLOW}Apply in order at: ${NEXT_PUBLIC_SUPABASE_URL:-https://supabase.com}/project/default/sql${NC}"
  for M in "${MIGRATIONS[@]}"; do echo "  ${CYAN}→${NC} supabase/migrations/$M"; done
  track_todo "Apply all 4 migrations in Supabase SQL editor (in order)"
fi

# ── 7. Admin user ─────────────────────────────────────────────
step "7/11 · Set admin user"
echo "  Run in Supabase SQL editor after migrations:"
echo ""
echo "  ${CYAN}UPDATE profiles SET role = 'admin'"
echo "  WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL');${NC}"
echo ""
track_todo "Set admin role — update the SQL above with your email and run it"

# ── 8. Generate TypeScript types ──────────────────────────────
step "8/11 · TypeScript types from Supabase"
if $SUPABASE_CLI && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  PROJECT_ID=$(echo "${NEXT_PUBLIC_SUPABASE_URL}" | sed 's|https://||;s|\.supabase\.co.*||')
  supabase gen types typescript --project-id "$PROJECT_ID" > lib/supabase/types.ts 2>/dev/null \
    && ok "Types generated → lib/supabase/types.ts" \
    || { track_warn "Type generation failed — run: npm run db:types"; }
else
  [ -f lib/supabase/types.ts ] || echo "export type Database = { public: { Tables: Record<string, any>; Views: Record<string, any>; Functions: Record<string, any> } }" > lib/supabase/types.ts
  ok "Placeholder types in place"
  track_todo "After Supabase is configured + migrated, run: npm run db:types"
fi

# ── 9. Stripe prices ─────────────────────────────────────────
step "9/11 · Stripe storage subscription prices"
if [ -n "${STRIPE_SECRET_KEY:-}" ] && [ -z "${STRIPE_PRICE_STORAGE_BASIC:-}" ]; then
  node scripts/create-stripe-prices.js 2>/dev/null && ok "Stripe prices created" \
    || { track_warn "Stripe prices failed — run: node scripts/create-stripe-prices.js"; }
elif [ -n "${STRIPE_PRICE_STORAGE_BASIC:-}" ]; then
  ok "Stripe prices already configured"
else
  track_warn "STRIPE_SECRET_KEY not set — run script after adding key"
  track_todo "Run: node scripts/create-stripe-prices.js → add IDs to .env.local"
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-https://tightspothelper.com}"

# ── 10. Manual service config summary ────────────────────────
step "10/11 · Manual configuration required"

cat << MANUAL

  ${YELLOW}SUPABASE AUTH — Dashboard → Authentication${NC}
  ┌─ URL Configuration → Redirect URLs (add both):
  │   http://localhost:3000/auth/callback
  │   ${APP_URL}/auth/callback
  └─ Providers → Enable Google and Apple OAuth

  ${YELLOW}DAILY.CO — Dashboard → Developers → Webhooks${NC}
  ┌─ Endpoint: ${APP_URL}/api/webhooks/daily
  └─ Events:   recording.ready-to-download  meeting.ended
               recording.error              participant.joined  participant.left

  ${YELLOW}STRIPE — Dashboard → Developers → Webhooks${NC}
  ┌─ Enable Connect: https://dashboard.stripe.com/settings/connect
  ├─ Endpoint: ${APP_URL}/api/webhooks/stripe
  └─ Events:   payment_intent.succeeded        payment_intent.payment_failed
               customer.subscription.updated   customer.subscription.deleted
               account.updated

  ${YELLOW}CLOUDFLARE R2 — Dashboard → R2${NC}
  ┌─ Create bucket: ${R2_BUCKET_NAME:-tightspothelper-recordings}
  ├─ CORS policy: allow PUT/GET from ${APP_URL} and http://localhost:3000
  └─ API Token: Object Read & Write on that bucket

MANUAL

track_todo "Add Supabase redirect URLs + enable OAuth providers"
track_todo "Configure Daily.co webhook endpoint"
track_todo "Enable Stripe Connect + configure webhook endpoint"
track_todo "Create R2 bucket + set CORS"

# ── 11. Railway deployment ────────────────────────────────────
step "11/11 · Railway deployment"

if $RAILWAY_CLI; then
  railway link 2>/dev/null && ok "Railway linked" \
    || { track_warn "railway link failed — run manually"; track_todo "Run: railway link"; }
  [ $MISSING -eq 0 ] && {
    info "Syncing env vars to Railway..."
    while IFS= read -r line; do
      [[ "$line" =~ ^#|^$ ]] && continue
      railway variables set "$line" --quiet 2>/dev/null || true
    done < .env.local
    ok "Env vars synced to Railway"
  } || track_warn "Skipped Railway env sync — fill in missing vars first"
else
  echo "  railway login && railway link && railway up"
  echo "  (or: git push origin main — Railway auto-deploys)"
fi

# TypeScript + lint
if [ $MISSING -eq 0 ]; then
  npx tsc --noEmit 2>&1 | tail -5 && ok "TypeScript: clean" || track_warn "TypeScript errors — run: npx tsc --noEmit"
  npm run lint 2>&1 | tail -3 && ok "ESLint: clean"       || track_warn "Lint errors — run: npm run lint"
fi

# ── Copilot review notice ─────────────────────────────────────
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}${BOLD}  GITHUB COPILOT REVIEW INSTRUCTIONS${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  COPILOT.md is a structured review checklist. Copilot should:"
echo ""
echo "  1. Open COPILOT.md and work through all 10 sections"
echo "  2. Verify every item is implemented in the codebase"
echo "  3. Flag any gaps as inline TODO comments or in a summary"
echo "  4. Pay special attention to Section 9 (known TODOs)"
echo ""
echo "  ${CYAN}VS Code Copilot Chat:${NC}"
echo "  @workspace Review COPILOT.md section by section and verify"
echo "  each item is correctly implemented. Flag any issues."
echo ""
echo "  ${CYAN}Or run the verification commands from Section 10:${NC}"
echo "  npx tsc --noEmit"
echo "  grep -rn 'process.env.' --include='*.ts' app/ | grep -v api/"
echo "  grep -rn 'sendSession\|sendExpert\|sendApplication\|sendRecording' app/api/"
echo ""

# ── Final summary ─────────────────────────────────────────────
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  Summary${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

[ ${#WARNINGS[@]} -gt 0 ] && {
  echo -e "${YELLOW}Warnings (${#WARNINGS[@]}):${NC}"
  for w in "${WARNINGS[@]}"; do echo "  ⚠  $w"; done
  echo ""
}

[ ${#TODOS[@]} -gt 0 ] && {
  echo -e "${CYAN}Remaining TODOs (${#TODOS[@]}):${NC}"
  for i in "${!TODOS[@]}"; do echo "  $((i+1)). ${TODOS[$i]}"; done
  echo ""
}

echo -e "${GREEN}Commands:${NC}"
echo "  npm run dev                          # Dev server"
echo "  npm run db:types                     # Regen Supabase types"
echo "  node scripts/create-stripe-prices.js # Create Stripe prices"
echo "  git push origin main                 # Deploy to Railway"
echo "  railway logs                         # View production logs"
echo ""
echo "  ${CYAN}Copilot review: cat COPILOT.md${NC}"
echo ""
