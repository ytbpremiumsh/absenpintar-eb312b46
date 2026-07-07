import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your email',
  invite: "You've been invited",
  magiclink: 'Your login link',
  recovery: 'Reset your password',
  email_change: 'Confirm your new email',
  reauthentication: 'Your verification code',
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
const SITE_NAME = "absenpintar"
const SENDER_DOMAIN = "notify.atskolla.com"
const ROOT_DOMAIN = "atskolla.com"
const FROM_DOMAIN = SENDER_DOMAIN

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://absenpintar.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function smtpUsesImplicitTls(settings: { smtp_port: number; smtp_secure: boolean }) {
  const port = Number(settings.smtp_port)
  if (port === 465) return true
  if (port === 587) return false
  return Boolean(settings.smtp_secure)
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Webhook handler - verifies signature and sends email
async function handleWebhook(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify signature + timestamp, then parse payload.
  let payload: any
  let run_id = ''
  try {
    const verified = await verifyWebhookRequest({
      req,
      secret: apiKey,
      parser: parseEmailWebhookPayload,
    })
    payload = verified.payload
    run_id = payload.run_id
  } catch (error) {
    if (error instanceof WebhookError) {
      switch (error.code) {
        case 'invalid_signature':
        case 'missing_timestamp':
        case 'invalid_timestamp':
        case 'stale_timestamp':
          console.error('Invalid webhook signature', { error: error.message })
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        case 'invalid_payload':
        case 'invalid_json':
          console.error('Invalid webhook payload', { error: error.message })
          return new Response(
            JSON.stringify({ error: 'Invalid webhook payload' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
      }
    }

    console.error('Webhook verification failed', { error })
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!run_id) {
    console.error('Webhook payload missing run_id')
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (payload.version !== '1') {
    console.error('Unsupported payload version', { version: payload.version, run_id })
    return new Response(
      JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // The email action type is in payload.data.action_type (e.g., "signup", "recovery")
  // payload.type is the hook event type ("auth")
  const emailType = payload.data.action_type
  console.log('Received auth event', { emailType, email: payload.data.email, run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Build template props from payload.data (HookData structure)
  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: payload.data.email,
    confirmationUrl: payload.data.url,
    token: payload.data.token,
    email: payload.data.email,
    oldEmail: payload.data.old_email,
    newEmail: payload.data.new_email,
  }

  // Initialize backend client early to fetch custom DB template.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Try to load a custom template (subject/html/sender_name) from DB. Fallback to React template.
  let subject = EMAIL_SUBJECTS[emailType] || 'Notification'
  let senderName = SITE_NAME
  let html: string
  let text: string

  const { data: dbTpl } = await supabase
    .from('auth_email_templates')
    .select('subject, html, sender_name')
    .eq('type', emailType)
    .maybeSingle()

  if (dbTpl && dbTpl.html) {
    const vars: Record<string, string> = {
      site_name: SITE_NAME,
      site_url: `https://${ROOT_DOMAIN}`,
      recipient: payload.data.email ?? '',
      email: payload.data.email ?? '',
      confirmation_url: payload.data.url ?? '',
      token: payload.data.token ?? '',
      old_email: payload.data.old_email ?? '',
      new_email: payload.data.new_email ?? '',
    }
    const replace = (input: string) =>
      input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => vars[String(k).toLowerCase()] ?? '')
    subject = replace(dbTpl.subject || subject)
    senderName = dbTpl.sender_name || SITE_NAME
    html = replace(dbTpl.html)
    text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } else {
    html = await renderAsync(React.createElement(EmailTemplate, templateProps))
    text = await renderAsync(React.createElement(EmailTemplate, templateProps), { plainText: true })
  }

  const messageId = crypto.randomUUID()

  const { data: smtpSettings } = await supabase
    .from('email_settings')
    .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_secure, from_email, from_name, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: payload.data.email,
    status: 'pending',
  })

  if (smtpSettings?.smtp_host && smtpSettings?.smtp_username && smtpSettings?.smtp_password && smtpSettings?.from_email) {
    try {
      const client = new SMTPClient({
        connection: {
          hostname: smtpSettings.smtp_host,
          port: Number(smtpSettings.smtp_port) || 587,
          tls: smtpUsesImplicitTls(smtpSettings),
          auth: { username: smtpSettings.smtp_username, password: smtpSettings.smtp_password },
        },
      })

      try {
        await client.send({
          from: `${senderName || smtpSettings.from_name || SITE_NAME} <${smtpSettings.from_email}>`,
          to: payload.data.email,
          subject,
          html,
          content: text || stripHtml(html),
        })
      } finally {
        try { await client.close() } catch { /* ignore */ }
      }

      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: emailType,
        recipient_email: payload.data.email,
        status: 'sent',
        metadata: { via: 'smtp_settings' },
      })
      await supabase.from('email_logs').insert({
        to_email: payload.data.email,
        subject,
        event_type: `auth_${emailType}`,
        status: 'sent',
      })

      console.log('Auth email sent via SMTP settings', { emailType, email: payload.data.email, run_id })
      return new Response(
        JSON.stringify({ success: true, sent: true, via: 'smtp_settings' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('SMTP auth email send failed', { emailType, run_id, error: errorMsg })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: emailType,
        recipient_email: payload.data.email,
        status: 'failed',
        error_message: errorMsg.slice(0, 1000),
        metadata: { via: 'smtp_settings' },
      })
      await supabase.from('email_logs').insert({
        to_email: payload.data.email,
        subject,
        event_type: `auth_${emailType}`,
        status: 'failed',
        error: errorMsg.slice(0, 1000),
      })

      return new Response(JSON.stringify({ success: false, error: errorMsg, via: 'smtp_settings' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // SMTP VPS wajib aktif — tidak ada fallback ke domain lain.
  const errMsg = 'SMTP VPS belum dikonfigurasi. Aktifkan di Pengaturan Email (SMTP) terlebih dahulu.'
  console.error(errMsg, { emailType, run_id })
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: payload.data.email,
    status: 'failed',
    error_message: errMsg,
  })
  await supabase.from('email_logs').insert({
    to_email: payload.data.email,
    subject,
    event_type: `auth_${emailType}`,
    status: 'failed',
    error: errMsg,
  })
  return new Response(
    JSON.stringify({ success: false, error: errMsg }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  // Main webhook handler
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
