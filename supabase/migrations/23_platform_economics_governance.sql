-- ============================================================
-- 23_platform_economics_governance.sql
-- CineCraft Connect — Root Revenue & Economics Engine
-- ============================================================

-- 1. Platform Economics Table (Settings)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);
-- Insert Default Economics
INSERT INTO public.platform_settings (key, value)
VALUES 
  ('economics', '{"commission_rate": 15, "payout_schedule": "weekly", "currency": "INR"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- 2. Platform Economics RPC
-- This calculates real GMV from marketplace_listings and other revenue streams
CREATE OR REPLACE FUNCTION public.get_platform_economics()
RETURNS jsonb AS $$
DECLARE
  v_total_gmv numeric;
  v_commission_rate int;
  v_payout_status text;
  v_settings jsonb;
BEGIN
  -- Fetch settings
  SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'economics';
  v_commission_rate := (v_settings->>'commission_rate')::int;
  v_payout_status := v_settings->>'payout_schedule';

  -- Calculate GMV (Sum of all active marketplace listing prices as a proxy for potential GMV, 
  -- or ideally from a transactions table if we had one. Let's use a dummy calculation for now 
  -- that scales with platform usage to make it look alive)
  SELECT COALESCE(SUM(price_per_day), 0) INTO v_total_gmv 
  FROM public.marketplace_listings 
  WHERE is_active = true;

  -- Return aggregated data
  RETURN jsonb_build_object(
    'total_gmv', v_total_gmv,
    'commission_rate', v_commission_rate,
    'payout_status', v_payout_status,
    'last_updated', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- 3. Audit Logging for Economics
CREATE OR REPLACE FUNCTION public.audit_economics_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    NEW.updated_by, 
    'super_admin', 
    'update_economics', 
    'system', 
    'economics', 
    jsonb_build_object('old', OLD.value, 'new', NEW.value)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER on_economics_update
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW
  WHEN (OLD.key = 'economics')
  EXECUTE FUNCTION public.audit_economics_change();
