-- Drop tables (CASCADE clears foreign keys from payment_transactions.plan_id etc.)
DROP TABLE IF EXISTS public.school_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.promo_content CASCADE;
DROP TABLE IF EXISTS public.qr_instructions CASCADE;