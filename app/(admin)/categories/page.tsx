import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageShell } from '@/components/ui/Shell'
import CategoryEditor from './CategoryEditor'

export default async function AdminCategories() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role,full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/customer/dashboard')

  const { data: categories } = await supabase.from('categories').select('*').order('sort_order')

  return (
    <PageShell role="admin" userName={profile?.full_name}>
      <div className="p-8 max-w-4xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-white">Category fees</h1>
          <p className="text-ink-400 text-sm mt-1">Set fee type, value, and rate guardrails per category. Changes apply to all new bookings immediately.</p>
        </div>
        <CategoryEditor categories={categories ?? []} />
      </div>
    </PageShell>
  )
}
