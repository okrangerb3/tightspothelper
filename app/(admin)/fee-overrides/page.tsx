import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageShell } from '@/components/ui/Shell'
import FeeOverrideManager from './FeeOverrideManager'

export default async function AdminFeeOverridesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/customer/dashboard')

  const { data: categories } = await supabase
    .from('categories').select('id, name, fee_type, fee_value').eq('active', true).order('name')

  const { data: overrides } = await supabase
    .from('fee_overrides')
    .select('*, category:category_id(name)')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: false })

  return (
    <PageShell role="admin" userName={profile?.full_name}>
      <div className="p-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white">Fee overrides</h1>
          <p className="text-ink-400 text-sm mt-1">
            Create temporary promotional fee reductions. Overrides apply to all new bookings in that category during the period.
          </p>
        </div>
        <FeeOverrideManager categories={categories ?? []} overrides={overrides ?? []} />
      </div>
    </PageShell>
  )
}
