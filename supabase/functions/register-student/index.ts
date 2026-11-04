// Supabase Edge Function: register-student
// Wraps the register_student() SECURITY DEFINER function and hashes
// the client IP before passing it in — the raw IP never touches the DB.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data    = encoder.encode(text)
  const hash    = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { matric_number } = body

    if (!matric_number || typeof matric_number !== 'string') {
      return new Response(
        JSON.stringify({ success: false, code: 'INVALID_INPUT', message: 'matric_number is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Hash the caller IP for privacy
    const ip     = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ipHash = await sha256(ip + ':nicesa-salt')

    // Use the anon key — the DB function is SECURITY DEFINER
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data, error } = await supabase.rpc('register_student', {
      p_matric:  matric_number.trim().toUpperCase(),
      p_ip_hash: ipHash,
    })

    if (error) {
      return new Response(
        JSON.stringify({ success: false, code: 'DB_ERROR', message: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, code: 'INTERNAL_ERROR', message: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
