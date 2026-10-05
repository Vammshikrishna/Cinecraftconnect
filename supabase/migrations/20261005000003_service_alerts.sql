-- Alerts for services: the existing "gear alerts" table now also holds alerts for vendor services.
-- Run AFTER part R. Safe to re-run.
--   kind = 'gear'     -> matches new marketplace listings (unchanged behaviour)
--   kind = 'service'  -> matches new vendor service packages (keyword in title/description, vendor category, max day rate)

ALTER TABLE public.gear_alerts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'gear';
ALTER TABLE public.gear_alerts DROP CONSTRAINT IF EXISTS gear_alerts_kind_check;
ALTER TABLE public.gear_alerts ADD CONSTRAINT gear_alerts_kind_check CHECK (kind IN ('gear', 'service'));

-- gear matching only looks at gear alerts now
CREATE OR REPLACE FUNCTION public.notify_gear_alert_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, title, message, action_url, trigger_user_id, related_id)
  SELECT a.user_id, 'gear_alert', 'New Gear Alert Match',
         'A listing matching your alert has been added: ' || NEW.title, '/marketplace/' || NEW.id, NEW.user_id, NEW.id
  FROM gear_alerts a
  WHERE a.kind = 'gear'
    AND a.user_id <> NEW.user_id
    AND (a.category IS NULL OR a.category = NEW.category)
    AND (a.keyword IS NULL OR NEW.title ILIKE '%' || a.keyword || '%')
    AND (a.max_price IS NULL OR NEW.price_per_day <= a.max_price);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_service_alert_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vendor vendors%ROWTYPE;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT * INTO v_vendor FROM vendors WHERE id = NEW.vendor_id;
  IF v_vendor.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, title, message, action_url, trigger_user_id, related_id)
  SELECT a.user_id, 'service_alert', 'New service matching your alert',
         NEW.title || ' · ' || v_vendor.business_name, '/vendors/' || NEW.vendor_id::text, v_vendor.owner_id, NEW.vendor_id
  FROM gear_alerts a
  WHERE a.kind = 'service'
    AND a.user_id <> v_vendor.owner_id
    AND (a.category IS NULL OR a.category = ANY (v_vendor.category))
    AND (a.keyword IS NULL OR NEW.title ILIKE '%' || a.keyword || '%' OR NEW.description ILIKE '%' || a.keyword || '%'
         OR v_vendor.business_name ILIKE '%' || a.keyword || '%')
    AND (a.max_price IS NULL OR NEW.day_rate <= a.max_price);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_service_alert_match ON public.vendor_services;
CREATE TRIGGER trg_notify_service_alert_match AFTER INSERT ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.notify_service_alert_match();
