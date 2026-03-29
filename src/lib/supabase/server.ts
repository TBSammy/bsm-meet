import { createClient } from '@supabase/supabase-js'

// Server-side client with service role key (bypasses RLS)
// Only use in Server Components and Route Handlers
export function createServerClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required in production')
    }
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set — using anon key. DB queries subject to RLS.')
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )
}

// Helper to query nt_demo schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ntDemo(client: any) {
  return client.schema('nt_demo')
}
