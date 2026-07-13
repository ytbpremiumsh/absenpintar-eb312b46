import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tables we explicitly skip from backup (managed by Supabase or transient)
const SKIP_TABLES = new Set<string>([
  'parent_otps',          // transient OTP codes
  'parent_sessions',      // transient sessions
  'password_reset_otps',  // transient OTP
])

const PAGE_SIZE = 1000

async function listPublicTables(supabase: any): Promise<string[]> {
  // Use information_schema via RPC fallback. We use the REST api with a raw query is not available,
  // so try a known-safe approach: query pg_tables via PostgREST? Not possible.
  // Use a hardcoded discovery by attempting select on known tables list maintained below as fallback.
  // Best approach: call sql via supabase.rpc on a security-definer function — none exists.
  // Solution: maintain an EXTENDED list mirroring current schema, plus skip set.
  return [
    'affiliate_commissions', 'affiliate_withdrawals', 'affiliates',
    'attendance_logs', 'bendahara_settings', 'class_teachers', 'classes',
    'email_logs', 'email_settings',
    'id_card_designs', 'id_card_order_items', 'id_card_orders',
    'landing_content', 'landing_testimonials', 'landing_trusted_schools',
    'login_logs', 'notifications',
    'parent_leave_requests', 'parent_messages',
    'payment_transactions', 'dismissal_logs', 'dismissal_settings',
    'platform_settings', 'point_transactions', 'profiles',
    'referrals',
    'reward_claims', 'rewards',
    'school_addons', 'school_announcements', 'school_groups',
    'school_integrations', 'schools',
    'spp_invoices', 'spp_logs', 'spp_settlements', 'spp_tariffs',
    'student_grades', 'students', 'subject_attendance', 'subjects',
    'support_tickets', 'teaching_schedules',
    'ticket_replies', 'user_roles', 'wa_credits', 'wa_message_logs',
  ]
}

async function fetchAllRows(supabase: any, table: string): Promise<any[]> {
  const all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error(`Error exporting ${table} at offset ${from}:`, error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
    // Safety: max 200k rows per table
    if (from > 200000) break
  }
  return all
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').maybeSingle()
    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden: super_admin only' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { action } = body

    const tables = (await listPublicTables(supabase)).filter(t => !SKIP_TABLES.has(t))

    if (action === 'export') {
      const backup: Record<string, any[]> = {}
      const stats: Record<string, number> = {}
      const errors: Record<string, string> = {}

      for (const table of tables) {
        try {
          const rows = await fetchAllRows(supabase, table)
          backup[table] = rows
          stats[table] = rows.length
        } catch (e: any) {
          errors[table] = e?.message || String(e)
          backup[table] = []
          stats[table] = 0
        }
      }

      const totalRows = Object.values(stats).reduce((a, b) => a + b, 0)

      await supabase.from('platform_settings').upsert({
        key: 'last_backup_at',
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

      await supabase.from('platform_settings').upsert({
        key: 'last_backup_stats',
        value: JSON.stringify({ tables: Object.keys(stats).length, total_rows: totalRows, stats }),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' })

      return new Response(JSON.stringify({
        success: true,
        backup,
        meta: {
          version: 2,
          exported_at: new Date().toISOString(),
          tables: Object.keys(stats).length,
          total_rows: totalRows,
          stats,
          errors,
          skipped: Array.from(SKIP_TABLES),
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'stats') {
      const stats: Record<string, number> = {}
      for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
        if (error) {
          stats[table] = 0
        } else {
          stats[table] = count || 0
        }
      }
      const totalRows = Object.values(stats).reduce((a, b) => a + b, 0)

      const [lastBackup, lastStats] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'last_backup_at').maybeSingle(),
        supabase.from('platform_settings').select('value').eq('key', 'last_backup_stats').maybeSingle(),
      ])

      let parsedStats = null
      if (lastStats.data?.value) {
        try {
          parsedStats = JSON.parse(lastStats.data.value)
          // Compat: old key 'totalRows' -> 'total_rows'
          if (parsedStats && parsedStats.totalRows != null && parsedStats.total_rows == null) {
            parsedStats.total_rows = parsedStats.totalRows
          }
        } catch { parsedStats = null }
      }

      return new Response(JSON.stringify({
        success: true,
        current: { tables: Object.keys(stats).length, total_rows: totalRows, stats },
        last_backup_at: lastBackup.data?.value || null,
        last_backup_stats: parsedStats,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'import') {
      const payload = body.backup as Record<string, any[]> | undefined
      const mode = (body.mode as string) || 'upsert' // 'upsert' | 'replace'
      if (!payload || typeof payload !== 'object') {
        return new Response(JSON.stringify({ success: false, error: 'Body harus mengandung "backup" (object per-tabel)' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Dependency order: parents first, children last.
      const RESTORE_ORDER = [
        'schools', 'school_groups', 'school_subscriptions',
        'profiles', 'user_roles',
        'classes', 'subjects', 'teaching_schedules', 'class_teachers',
        'students', 'student_grades',
        'attendance_logs', 'subject_attendance', 'teacher_attendance_logs',
        'dismissal_settings', 'dismissal_logs',
        'school_holidays', 'school_announcements', 'school_integrations',
        'spp_tariffs', 'spp_invoices', 'spp_logs', 'spp_settlements',
        'bendahara_settings', 'bendahara_bank_accounts',
        'id_card_designs', 'id_card_orders', 'id_card_order_items',
        'landing_content', 'landing_testimonials', 'landing_trusted_schools',
        'panduan_content', 'qr_instructions',
        'platform_settings', 'email_settings', 'email_logs',
        'notifications', 'login_logs',
        'affiliates', 'affiliate_commissions', 'affiliate_withdrawals', 'referrals',
        'rewards', 'reward_claims', 'point_transactions',
        'short_links', 'short_link_clicks',
        'parent_leave_requests', 'parent_messages',
        'payment_transactions', 'school_addons',
        'support_tickets', 'ticket_replies',
        'wa_credits', 'wa_message_logs',
      ]

      const CHUNK = 200
      const stats: Record<string, { inserted: number; failed: number; error?: string }> = {}

      const tablesInPayload = new Set(Object.keys(payload))
      const orderedTables = RESTORE_ORDER.filter(t => tablesInPayload.has(t))
      // Append any extra tables that were in payload but not in our order
      for (const t of tablesInPayload) if (!orderedTables.includes(t)) orderedTables.push(t)

      for (const table of orderedTables) {
        if (SKIP_TABLES.has(table)) continue
        const rows = payload[table] || []
        if (!Array.isArray(rows) || rows.length === 0) { stats[table] = { inserted: 0, failed: 0 }; continue }

        // Replace mode: wipe existing rows first (dangerous — for full migrations only).
        if (mode === 'replace') {
          try { await supabase.from(table).delete().not('id', 'is', null) } catch (_) {}
        }

        let inserted = 0
        let failed = 0
        let lastErr: string | undefined
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK)
          const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id', ignoreDuplicates: false })
          if (error) {
            // Retry row-by-row so a single bad row doesn't drop the whole chunk
            for (const row of chunk) {
              const { error: rowErr } = await supabase.from(table).upsert(row, { onConflict: 'id' })
              if (rowErr) { failed++; lastErr = rowErr.message } else { inserted++ }
            }
          } else {
            inserted += chunk.length
          }
        }
        stats[table] = { inserted, failed, error: lastErr }
      }

      const totalInserted = Object.values(stats).reduce((a, s) => a + s.inserted, 0)
      const totalFailed = Object.values(stats).reduce((a, s) => a + s.failed, 0)

      return new Response(JSON.stringify({
        success: true,
        mode,
        summary: {
          tables: Object.keys(stats).length,
          inserted: totalInserted,
          failed: totalFailed,
          imported_at: new Date().toISOString(),
        },
        stats,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action. Use "export", "import" or "stats"' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('database-backup error', err)
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
