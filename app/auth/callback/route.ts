import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/customer/dashboard'

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Upsert profile — handles both new OAuth users and returning ones
      const role = (data.user.user_metadata?.role as string) ?? 'customer'
      await supabase.from('profiles').upsert({
        id:        data.user.id,
        role,
        full_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? '',
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id', ignoreDuplicates: true })

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
