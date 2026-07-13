import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TABLES = [
  'schools', 'profiles', 'user_roles', 'students', 'classes', 'class_teachers',
  'attendance_logs', 'dismissal_logs', 'dismissal_settings', 'school_integrations',
  'payment_transactions',
  'notifications', 'support_tickets', 'ticket_replies', 'wa_message_logs',
  'landing_content', 'landing_testimonials', 'landing_trusted_schools',
  'platform_settings', 'referrals', 'point_transactions', 'rewards',
  'reward_claims', 'affiliates', 'affiliate_commissions', 'affiliate_withdrawals',
  'login_logs', 'school_groups',
]

async function uploadToGoogleDrive(accessToken: string, fileName: string, content: string, folderId?: string) {
  // Create the file metadata
  const metadata: any = {
    name: fileName,
    mimeType: 'application/json',
  }
  if (folderId) {
    metadata.parents = [folderId]
  }

  // Use multipart upload
  const boundary = 'foo_bar_baz'
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Drive upload failed: ${res.status} - ${err}`)
  }

  return await res.json()
}

async function findOrCreateFolder(accessToken: string, folderName: string, parentId?: string) {
  // Search for existing folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  if (parentId) {
    query += ` and '${parentId}' in parents`
  }

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  const searchData = await searchRes.json()

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id
  }

  // Create folder
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentId) {
    metadata.parents = [parentId]
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Failed to create folder: ${createRes.status} - ${err}`)
  }

  const folder = await createRes.json()
  return folder.id
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').maybeSingle()
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin only' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json()
    const { action, google_access_token } = body

    if (action === 'backup-to-gdrive') {
      if (!google_access_token) {
        return new Response(JSON.stringify({ error: 'Google access token required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Export all tables
      const backup: Record<string, any[]> = {}
      const stats: Record<string, number> = {}

      for (const table of TABLES) {
        const { data, error } = await supabase.from(table).select('*').limit(10000)
        if (error) {
          console.error(`Error exporting ${table}:`, error.message)
          backup[table] = []
          stats[table] = 0
        } else {
          backup[table] = data || []
          stats[table] = (data || []).length
        }
      }

      const totalRows = Object.values(stats).reduce((a, b) => a + b, 0)
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0] // e.g. 2026-04-11

      // Create folder structure: ATSkolla Backup / 2026-04-11
      const rootFolderId = await findOrCreateFolder(google_access_token, 'ATSkolla Backup')
      const dateFolderId = await findOrCreateFolder(google_access_token, dateStr, rootFolderId)

      // Upload backup file
      const fileName = `backup_${now.toISOString().replace(/[:.]/g, '-')}.json`
      const content = JSON.stringify(backup, null, 2)
      const uploadResult = await uploadToGoogleDrive(google_access_token, fileName, content, dateFolderId)

      // Save backup metadata
      await supabase.from('platform_settings').upsert({
        key: 'last_gdrive_backup_at',
        value: now.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'key' })

      await supabase.from('platform_settings').upsert({
        key: 'last_gdrive_backup_stats',
        value: JSON.stringify({ tables: Object.keys(stats).length, totalRows, stats, fileId: uploadResult.id, fileName }),
        updated_at: now.toISOString(),
      }, { onConflict: 'key' })

      return new Response(JSON.stringify({
        success: true,
        message: `Backup berhasil diupload ke Google Drive`,
        meta: {
          exported_at: now.toISOString(),
          tables: Object.keys(stats).length,
          total_rows: totalRows,
          file_id: uploadResult.id,
          file_name: fileName,
          folder: `ATSkolla Backup/${dateStr}`,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'check-gdrive-status') {
      const [lastBackup, lastStats] = await Promise.all([
        supabase.from('platform_settings').select('value').eq('key', 'last_gdrive_backup_at').maybeSingle(),
        supabase.from('platform_settings').select('value').eq('key', 'last_gdrive_backup_stats').maybeSingle(),
      ])

      return new Response(JSON.stringify({
        success: true,
        last_backup_at: lastBackup.data?.value || null,
        last_backup_stats: lastStats.data?.value ? JSON.parse(lastStats.data.value) : null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('gdrive-backup error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})