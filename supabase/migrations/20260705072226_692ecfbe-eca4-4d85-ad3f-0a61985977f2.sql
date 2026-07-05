INSERT INTO public.platform_settings (key, value) VALUES
  ('active_payment_gateway', 'mayar'),
  ('doku_client_id', ''),
  ('doku_secret_key', ''),
  ('doku_env', 'production')
ON CONFLICT (key) DO NOTHING;