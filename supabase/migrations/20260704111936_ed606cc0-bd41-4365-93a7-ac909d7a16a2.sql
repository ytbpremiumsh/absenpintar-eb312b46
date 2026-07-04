DROP POLICY IF EXISTS "Authenticated read platform settings" ON public.platform_settings;

CREATE POLICY "Authenticated read non-secret platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (
  key NOT IN (
    'mayar_api_key',
    'meta_capi_access_token',
    'meta_test_event_code',
    'mpwa_platform_api_key',
    'mpwa_platform_sender',
    'mpwa_platform_connected',
    'wa_api_key',
    'wa_api_url',
    'admin_notify_phone',
    'admin_notify_enabled',
    'admin_notify_ticket_template',
    'admin_notify_withdrawal_template',
    'admin_notify_bendahara_template',
    'last_backup_at',
    'last_backup_stats'
  )
);