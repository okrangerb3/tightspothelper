#!/usr/bin/env node
// ============================================================
// TightSpotHelper — Create Stripe storage subscription prices
// Run: node scripts/create-stripe-prices.js
// Then add the output price IDs to .env.local and Railway env
// ============================================================

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('✗ STRIPE_SECRET_KEY not set in .env.local')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })

const TIERS = [
  {
    name:        'TightSpotHelper — Basic Storage',
    description: '10 GB recording + photo storage. Keep recordings forever. Download anytime.',
    gb:          10,
    priceCents:  600,   // $6.00/mo
    envKey:      'STRIPE_PRICE_STORAGE_BASIC',
    metadata:    { tier: 'basic', gb: '10', limit_bytes: String(10 * 1024 ** 3) },
  },
  {
    name:        'TightSpotHelper — Pro Storage',
    description: '50 GB recording + photo storage. Keep recordings forever. Priority support.',
    gb:          50,
    priceCents:  1500,  // $15.00/mo
    envKey:      'STRIPE_PRICE_STORAGE_PRO',
    metadata:    { tier: 'pro', gb: '50', limit_bytes: String(50 * 1024 ** 3) },
  },
  {
    name:        'TightSpotHelper — Unlimited Storage',
    description: 'Unlimited recording + photo storage. Keep recordings forever. Priority support.',
    gb:          -1,
    priceCents:  2900,  // $29.00/mo
    envKey:      'STRIPE_PRICE_STORAGE_UNLIMITED',
    metadata:    { tier: 'unlimited', gb: '-1', limit_bytes: '-1' },
  },
]

async function main() {
  console.log('\n🔧 Creating Stripe storage subscription products & prices...\n')

  const results = {}

  for (const tier of TIERS) {
    try {
      // Create product
      const product = await stripe.products.create({
        name:        tier.name,
        description: tier.description,
        metadata:    tier.metadata,
      })

      // Create monthly recurring price
      const price = await stripe.prices.create({
        product:    product.id,
        unit_amount: tier.priceCents,
        currency:   'usd',
        recurring:  { interval: 'month' },
        metadata:   tier.metadata,
      })

      results[tier.envKey] = price.id
      console.log(`  ✓ ${tier.name}`)
      console.log(`    Product: ${product.id}`)
      console.log(`    Price:   ${price.id}  ← copy this\n`)
    } catch (err) {
      console.error(`  ✗ Failed to create ${tier.name}:`, err.message)
    }
  }

  console.log('─'.repeat(60))
  console.log('\n📋 Add these to your .env.local:\n')
  for (const [key, id] of Object.entries(results)) {
    console.log(`  ${key}=${id}`)
  }

  console.log('\n📋 And to Railway:\n')
  const railwayCmd = Object.entries(results).map(([k, v]) => `${k}=${v}`).join(' ')
  console.log(`  railway variables set ${railwayCmd}`)
  console.log('\n✅ Done.\n')

  // Also configure the Stripe billing portal
  try {
    await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'TightSpotHelper — Manage your storage subscription',
      },
      features: {
        subscription_cancel:  { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
        subscription_update:  {
          enabled: true,
          default_allowed_updates: ['price'],
          proration_behavior: 'create_prorations',
          products: Object.values(results).map(priceId => ({
            product: '', // will be auto-set
            prices: [priceId],
          })),
        },
        payment_method_update: { enabled: true },
        invoice_history:       { enabled: true },
      },
    })
    console.log('  ✓ Stripe billing portal configured\n')
  } catch (err) {
    console.warn('  ⚠ Billing portal setup skipped (configure manually in Stripe dashboard):', err.message)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
