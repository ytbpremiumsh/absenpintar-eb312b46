-- Nightly retention cleanup for high-volume log tables.
-- Keeps the last 90 days; runs every night at 03:15 WIB (20:15 UTC).

CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_send_log     WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM public.email_logs         WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM public.wa_message_logs    WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM public.login_logs         WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM public.short_link_clicks  WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM public.rfid_device_logs   WHERE created_at < now() - INTERVAL '90 days';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'cleanup_old_logs failed: %', SQLERRM;
END;
$$;

-- Schedule via pg_cron (unschedule any existing job with the same name first).
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-logs');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-logs',
  '15 20 * * *',  -- 03:15 WIB daily
  $cron$ SELECT public.cleanup_old_logs(); $cron$
);
