#!/usr/bin/env bash
# Fix: add Notifications to nav, add category name/description/icon editing
set -e
if [ ! -f package.json ] || ! grep -q "tightspothelper" package.json 2>/dev/null; then
  echo "⚠️  Run from the repo root." >&2; exit 1
fi

# ── 1. Add Notifications to customer + expert nav ────────────────────────────
echo "→ adding Notifications to Shell.tsx nav"
python3 - << 'PYEOF'
content = open('components/shell/Shell.tsx').read()

# Add to customer nav
if '/customer/notifications' not in content:
    content = content.replace(
        "{ href: '/customer/profile',         label: 'Profile',     icon: '◉' },",
        "{ href: '/customer/profile',         label: 'Profile',     icon: '◉' },\n    { href: '/customer/notifications',   label: 'Alerts',      icon: '🔔' },"
    )
    print("  customer nav: Alerts added")

# Add to expert nav
if '/expert/notifications' not in content:
    content = content.replace(
        "{ href: '/expert/profile',     label: 'Profile',     icon: '◉' },",
        "{ href: '/expert/profile',     label: 'Profile',     icon: '◉' },\n    { href: '/expert/notifications',   label: 'Alerts',      icon: '🔔' },"
    )
    print("  expert nav: Alerts added")

# Add customers + financials to admin nav if missing
if '/admin/customers' not in content:
    content = content.replace(
        "{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },",
        "{ href: '/admin/recordings',    label: 'Recordings',  icon: '◷' },\n    { href: '/admin/customers',      label: 'Customers',   icon: '◍' },\n    { href: '/admin/financials',     label: 'Financials',  icon: '◐' },\n    { href: '/admin/category-requests', label: 'Requests',  icon: '◌' },\n    { href: '/admin/api-settings',   label: 'API Keys',    icon: '⚙' },"
    )
    print("  admin nav: Customers/Financials/Requests/API Keys added")

open('components/shell/Shell.tsx', 'w').write(content)
print("  Shell.tsx updated")
PYEOF

# ── 2. Update CategoryEditor to support name/slug/description/icon editing ──
echo "→ updating CategoryEditor with full edit support"
python3 - << 'PYEOF'
content = open('app/(admin)/admin/categories/CategoryEditor.tsx').read()

# Add edit fields inside each existing category card — after the fee section
# Find the fee preview block end and insert edit fields before it
old = '''          {cat.feeType === 'percentage' && (
            <div className="mt-4 surface p-3 rounded-xl">
              <p className="text-[10px] text-ink-500 mb-2">Fee preview (example $75/hr pro rate)</p>'''

new = '''          {/* Edit name, description, icon */}
          <div className="grid sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-ink-800/60">
            <div>
              <label className="label text-[10px]">Name</label>
              <input value={cat.name} onChange={e => update(cat.id, { name: e.target.value })}
                className="input py-1.5 text-xs" placeholder="Category name" />
            </div>
            <div>
              <label className="label text-[10px]">Slug</label>
              <input value={cat.slug} onChange={e => update(cat.id, { slug: e.target.value })}
                className="input py-1.5 text-xs" placeholder="url-slug" />
            </div>
            <div>
              <label className="label text-[10px]">Icon</label>
              <select value={cat.icon ?? ''} onChange={e => update(cat.id, { icon: e.target.value })}
                className="input py-1.5 text-xs">
                <option value="">No icon</option>
                <option value="ti-droplet">💧 Plumbing</option>
                <option value="ti-bolt">⚡ Electrical</option>
                <option value="ti-wind">❄️ HVAC</option>
                <option value="ti-tool">🔧 Appliances</option>
                <option value="ti-hammer">🔨 Handyman</option>
                <option value="ti-car">🚗 Automotive</option>
                <option value="ti-car">🚛 Diesel</option>
                <option value="ti-fish">⛵ Marine</option>
                <option value="ti-plant">🌿 Landscaping</option>
                <option value="ti-home">🏠 General</option>
                <option value="ti-wood">🪵 Carpenter</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="label text-[10px]">Description</label>
              <input value={cat.description ?? ''} onChange={e => update(cat.id, { description: e.target.value })}
                className="input py-1.5 text-xs" placeholder="Short description shown to customers" />
            </div>
          </div>

          {cat.feeType === 'percentage' && (
            <div className="mt-4 surface p-3 rounded-xl">
              <p className="text-[10px] text-ink-500 mb-2">Fee preview (example $75/hr pro rate)</p>'''

if old in content:
    content = content.replace(old, new)
    print("  edit fields added to category cards")
else:
    print("  WARNING: pattern not found — edit fields may need manual insertion")

# Also update the save function to include name, slug, description, icon
old_save = '''      body: JSON.stringify({
        fee_type:       cat.feeType,
        fee_value:      cat.feeValue,
        fee_flat_tiers: cat.feeFlatTiers,
        active:         cat.active,
        icon:           cat.icon,
        description:    cat.description,
      }),'''

new_save = '''      body: JSON.stringify({
        name:           cat.name,
        slug:           cat.slug,
        description:    cat.description,
        icon:           cat.icon,
        fee_type:       cat.feeType,
        fee_value:      cat.feeValue,
        fee_flat_tiers: cat.feeFlatTiers,
        active:         cat.active,
      }),'''

if old_save in content:
    content = content.replace(old_save, new_save)
    print("  save payload updated with name/slug/description")

# Add description and icon to Category interface if missing
if 'description?' not in content:
    content = content.replace(
        "  icon?: string | null\n}",
        "  icon?: string | null\n  description?: string | null\n}"
    )
    print("  interface updated")

open('app/(admin)/admin/categories/CategoryEditor.tsx', 'w').write(content)
PYEOF

# ── 3. Update the category PATCH API to accept name/slug/description ─────────
echo "→ updating admin category PATCH API"
if [ -f "app/api/admin/categories/[id]/route.ts" ]; then
python3 - << 'PYEOF'
content = open('app/api/admin/categories/[id]/route.ts').read()
if 'name' not in content:
    content = content.replace(
        "const { fee_type, fee_value, fee_flat_tiers, active",
        "const { name, slug, description, icon, fee_type, fee_value, fee_flat_tiers, active"
    )
    content = content.replace(
        "    data: {\n      feeType:",
        "    data: {\n      ...(name        ? { name }        : {}),\n      ...(slug        ? { slug }        : {}),\n      ...(description !== undefined ? { description } : {}),\n      ...(icon        !== undefined ? { icon }        : {}),\n      feeType:"
    )
    open('app/api/admin/categories/[id]/route.ts', 'w').write(content)
    print("  PATCH API updated")
else:
    print("  PATCH API already handles name/slug")
PYEOF
fi

echo ""
echo "✓ Applied:"
echo "  • Shell.tsx — Alerts (🔔) added to customer and expert nav"
echo "  • Shell.tsx — Admin nav updated with Customers, Financials, Requests, API Keys"
echo "  • CategoryEditor — name, slug, icon, description fields on every category card"
echo "  • Category PATCH API — now saves name/slug/description/icon changes"
echo ""
echo "Now run:"
echo "  git add -A && git commit -m 'Add notifications to nav, category full edit support' && git push"
