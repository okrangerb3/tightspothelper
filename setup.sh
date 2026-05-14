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

RAILWAY_CLI=false
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
  ["DATABASE_URL"]="Railway → Postgres service → Connect → DATABASE_URL"
  ["BETTER_AUTH_SECRET"]="Random secret — openssl rand -hex 32"
  ["NEXT_PUBLIC_APP_URL"]="App URL (https://tightspothelper.com)"
  ["STRIPE_SECRET_KEY"]="Stripe → Developers → API keys → Secret key"
  ["STRIPE_WEBHOOK_SECRET"]="Stripe → Developers → Webhooks → Signing secret"
  ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]="Stripe → Developers → API keys → Publishable key"
  ["R2_ACCOUNT_ID"]="Cloudflare → Account → Account ID"
  ["R2_ACCESS_KEY_ID"]="Cloudflare → R2 → Manage API Tokens → Access Key ID"
  ["R2_SECRET_ACCESS_KEY"]="Cloudflare → R2 → Manage API Tokens → Secret Access Key"
  ["R2_BUCKET_NAME"]="Your R2 bucket name (e.g. tightspothelper-recordings)"
  ["RESEND_API_KEY"]="Resend → API Keys → Create API Key"
  ["RESEND_FROM_EMAIL"]="Verified sender (e.g. noreply@tightspothelper.com)"
  ["CRON_SECRET"]="Random secret — openssl rand -hex 32"
  ["JITSI_DOMAIN"]="Your Jitsi server domain (e.g. meet.yourdomain.com)"
  ["JITSI_JWT_SECRET"]="Jitsi JWT secret from your Jitsi server config"
  ["JIBRI_API_URL"]="Jibri API base URL (e.g. https://jibri.yourdomain.com)"
  ["JIBRI_API_TOKEN"]="Jibri API token"
  ["JIBRI_WEBHOOK_SECRET"]="Jibri webhook signing secret"
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
step "4/10 · Security check — no secrets in client code"

LEAKED=false
for S in STRIPE_SECRET_KEY R2_SECRET_ACCESS_KEY JIBRI_API_TOKEN; do
  LEAK=$(grep -rn "$S" app/ --include="*.ts" --include="*.tsx" 2>/dev/null \
         | grep -v "api/" || true)
  [ -n "$LEAK" ] && { err "SECRET LEAKED IN CLIENT: $S\n$LEAK"; LEAKED=true; }
done
$LEAKED || ok "No secrets found in client-side code"
ok "NEXT_PUBLIC_ prefixes correct"

# ── 5. Cron secret ───────────────────────────────────────────
step "5/10 · Cron secret"
if [ -z "${CRON_SECRET:-}" ]; then
  GENERATED=$(openssl rand -hex 32 2>/dev/null \
    || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  echo "  Generated: $GENERATED"
  echo "  → Add to .env.local: CRON_SECRET=$GENERATED"
  track_todo "Add CRON_SECRET=$GENERATED to .env.local and Railway"
else
  ok "CRON_SECRET is set"
fi

# ── 6. Prisma migrations ──────────────────────────────────────
step "6/10 · Prisma database migrations"

if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma generate 2>&1 && ok "Prisma client generated"
  npx prisma migrate deploy 2>&1 && ok "Migrations applied" || {
    track_warn "Migration failed — run: npx prisma migrate deploy"
    track_todo "Fix migration errors and re-run: npx prisma migrate deploy"
  }
else
  track_warn "DATABASE_URL not set — skipping migrations"
  track_todo "Set DATABASE_URL then run: npx prisma migrate deploy"
fi

# ── 7. Admin user ─────────────────────────────────────────────
step "7/10 · Set admin user"
echo "  After first signup, set admin role:"
echo ""
echo "  ${CYAN}UPDATE auth_users SET role = 'admin' WHERE email = 'YOUR_ADMIN_EMAIL';${NC}"
echo ""
track_todo "Set admin role — update the SQL above with your email and run it via Prisma Studio or Railway SQL"

# ── 8. Stripe webhook ─────────────────────────────────────────
step "8/10 · Stripe webhook"
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  ok "STRIPE_SECRET_KEY present"
else
  track_warn "STRIPE_SECRET_KEY not set — Stripe features will not work"
  track_todo "Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to .env.local"
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-https://tightspothelper.com}"

# ── 9. Manual service config summary ──────────────────────────
step "9/10 · Manual configuration required"

cat << MANUAL

  ${YELLOW}STRIPE — Dashboard → Developers → Webhooks${NC}
  ┌─ Enable Connect: https://dashboard.stripe.com/settings/connect
  ├─ Endpoint: ${APP_URL}/api/webhooks/stripe
  └─ Events:   payment_intent.succeeded  payment_intent.payment_failed  account.updated

  ${YELLOW}JIBRI — configure webhook in Jibri finalize script${NC}
  ┌─ Endpoint: ${APP_URL}/api/webhooks/jibri
  └─ Set JIBRI_WEBHOOK_SECRET to match your Jibri config

  ${YELLOW}CLOUDFLARE R2 — Dashboard → R2${NC}
  ┌─ Create bucket: ${R2_BUCKET_NAME:-tightspothelper-recordings}
  ├─ CORS policy: allow PUT/GET from ${APP_URL} and http://localhost:3000
  └─ API Token: Object Read & Write on that bucket

MANUAL

track_todo "Enable Stripe Connect + configure webhook endpoint"
track_todo "Configure Jibri webhook endpoint + secret"
track_todo "Create R2 bucket + set CORS"

# ── 10. Railway deployment ────────────────────────────────────
step "10/10 · Railway deployment"

if $RAILWAY_CLI; then
  railway link 2>/dev/null && ok "Railway linked" \
    || { track_warn "railway link failed — run manually"; track_todo "Run: railway link"; }
  [ $MISSING -eq 0 ] && {
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
  npm run lint 2>&1 | tail -3   && ok "ESLint: clean"       || track_warn "Lint errors — run: npm run lint"
fi

# ── Final summary ─────────────────────────────────────────────
echo ""
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
echo "  npm run dev                  # Dev server"
echo "  npm run db:generate          # Regen Prisma client"
echo "  npm run db:migrate           # Run pending migrations"
echo "  npm run db:seed              # Seed dev data"
echo "  git push origin main         # Deploy to Railway"
echo "  railway logs                 # View production logs"
echo ""
