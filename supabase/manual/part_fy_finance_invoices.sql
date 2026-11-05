-- PART FY (finance 1) - tax settings, numbered tax invoices and credit notes, and a finance report for the super admin.
-- Safe to run more than once. Nothing here moves money and nothing is charged: the tax rate starts at 0 (off), and billing is still in beta.
--
-- WHAT THE FINANCE REVIEW FOUND:
--   * Receipts were numbered "CC-" + the first 8 characters of the order id: random, not in a running series, and two orders can share a number.
--     A tax invoice must have a unique, sequential number per financial year (India: at most 16 characters).
--   * Tax was never computed: orders.tax_minor stays 0 whatever the rate, so going live would charge no GST.
--   * No invoice or credit note record: nothing to show a buyer, an accountant or an auditor, and a refund left no credit note.
--   * No finance report and no check that the ledger balances.
--
-- WHAT THIS PART ADDS
--   1. Settings in platform_settings (all start empty / off): tax_rate_bps (1800 = 18%), tax_label, invoice_prefix, company_legal_name, company_gstin,
--      company_address, company_state_code, company_pan, sac_code. Set them with staff_set_finance_details (super admin, needs a reason, audited),
--      or in the Billing tab > "Finance".
--   2. A trigger that adds tax to orders the PLATFORM sells (subscriptions, products, promotions) when the rate is above 0. Seller-to-buyer
--      marketplace orders are left alone (their tax depends on the seller, decide that with your accountant).
--   3. invoices: one numbered tax invoice per paid order (CC/26-27/000001 = prefix / Indian financial year Apr-Mar / running number) and one credit note
--      per processed refund (CN/26-27/000001), with a snapshot of the seller and buyer details, so later edits never change an issued document.
--      The triggers can never block a payment: any failure in them is logged as a warning and the payment goes through.
--   4. my_invoice(order) and my_invoice_numbers(): what a buyer can read about their own invoices. staff_finance_report(from, to): revenue, tax,
--      fees, refunds, chargebacks, orders by status, the ledger by account and an "is the ledger balanced" check. staff_set_finance_details.
--
-- PREFLIGHT (read only):  select to_regclass('public.invoices') as invoices_table;                  -- null before this part
--                         select key, value from public.platform_settings where key in ('tax_rate_bps','company_gstin');   -- no rows before
-- POST-CHECK  (read only): select key, value from public.platform_settings where key like 'company_%' or key like 'tax_%' or key = 'invoice_prefix';  -- 11 rows
--                         select count(*) from public.invoices;                                      -- 0 until the first paid order
--                         select tgname from pg_trigger where tgrelid = 'public.orders'::regclass and tgname in ('orders_apply_tax','orders_issue_invoice');  -- 2 rows
--   Then, as a super admin, open Super admin > Billing > Finance: it shows the report and "Ledger balanced".
--
-- WHEN YOU ARE READY TO CHARGE GST (with your accountant): fill in the company details, set tax_rate_bps (for example 1800), and decide whether the listed
-- prices include GST. Today prices are treated as EXCLUDING tax (tax is added on top), and the Plans page says so once the rate is above 0.

SET lock_timeout = '5s';

-- 1. settings (empty / off) -------------------------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value) VALUES
  ('tax_rate_bps', '0'::jsonb),
  ('tax_label', '"GST"'::jsonb),
  ('invoice_prefix', '"CC"'::jsonb),
  ('company_legal_name', 'null'::jsonb),
  ('company_gstin', 'null'::jsonb),
  ('company_address', 'null'::jsonb),
  ('company_state_code', 'null'::jsonb),
  ('company_pan', 'null'::jsonb),
  ('sac_code', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_setting(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT NULLIF(btrim(s.value #>> '{}'), '') FROM public.platform_settings s WHERE s.key = p_key $$;
REVOKE ALL ON FUNCTION public.finance_setting(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_setting(text) TO service_role;

-- 2. tax on what the platform sells ----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.orders_apply_tax()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate integer;
BEGIN
  BEGIN
    v_rate := COALESCE(NULLIF(public.finance_setting('tax_rate_bps'), '')::integer, 0);
    IF NEW.tax_minor = 0 AND NEW.seller_id IS NULL AND v_rate > 0 AND NEW.amount_minor > 0 THEN
      NEW.tax_minor := round(NEW.amount_minor::numeric * v_rate / 10000)::integer;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'orders_apply_tax skipped: %', SQLERRM;     -- a tax problem must never stop an order
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_apply_tax() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS orders_apply_tax ON public.orders;
CREATE TRIGGER orders_apply_tax BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_apply_tax();

-- 3. invoices and credit notes -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  fy        text NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('invoice', 'credit_note')),
  last_seq  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (fy, kind)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL CHECK (kind IN ('invoice', 'credit_note')),
  invoice_no          text NOT NULL UNIQUE,
  fy                  text NOT NULL,
  seq                 integer NOT NULL,
  order_id            uuid NOT NULL REFERENCES public.orders(id),
  related_invoice_id  uuid REFERENCES public.invoices(id),
  refund_id           uuid REFERENCES public.refunds(id),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  currency            text NOT NULL DEFAULT 'INR',
  taxable_minor       integer NOT NULL CHECK (taxable_minor >= 0),
  tax_minor           integer NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor         integer NOT NULL CHECK (total_minor >= 0),
  tax_rate_bps        integer NOT NULL DEFAULT 0,
  tax_label           text,
  sac_code            text,
  supplier            jsonb NOT NULL DEFAULT '{}'::jsonb,   -- the company details as they were on the day
  buyer               jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines               jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_order ON public.invoices (order_id) WHERE kind = 'invoice';
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_per_refund ON public.invoices (refund_id) WHERE kind = 'credit_note';
CREATE UNIQUE INDEX IF NOT EXISTS invoices_series ON public.invoices (fy, kind, seq);
CREATE INDEX IF NOT EXISTS invoices_order ON public.invoices (order_id);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
-- no policies: people read their own through my_invoice(), staff through staff_finance_report(); nothing writes from the app
REVOKE ALL ON public.invoice_counters FROM anon, authenticated;
REVOKE ALL ON public.invoices FROM anon, authenticated;

-- an issued invoice never changes (correct it with a credit note)
CREATE OR REPLACE FUNCTION public.invoices_are_final()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'An issued invoice cannot be changed or deleted. Issue a credit note instead.';
END;
$$;
DROP TRIGGER IF EXISTS invoices_no_change ON public.invoices;
CREATE TRIGGER invoices_no_change BEFORE UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.invoices_are_final();

-- Indian financial year of a moment: April to March, shown as "26-27"
CREATE OR REPLACE FUNCTION public._fy_label(p_at timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lpad((y % 100)::text, 2, '0') || '-' || lpad(((y + 1) % 100)::text, 2, '0')
  FROM (SELECT extract(year FROM ((p_at AT TIME ZONE 'Asia/Kolkata') - interval '3 months'))::int AS y) q
$$;

CREATE OR REPLACE FUNCTION public._next_invoice_no(p_kind text, p_at timestamptz, OUT o_no text, OUT o_fy text, OUT o_seq integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
BEGIN
  o_fy := public._fy_label(p_at);
  INSERT INTO public.invoice_counters (fy, kind, last_seq) VALUES (o_fy, p_kind, 1)
  ON CONFLICT (fy, kind) DO UPDATE SET last_seq = public.invoice_counters.last_seq + 1
  RETURNING last_seq INTO o_seq;
  v_prefix := CASE WHEN p_kind = 'credit_note' THEN 'CN' ELSE COALESCE(public.finance_setting('invoice_prefix'), 'CC') END;
  o_no := v_prefix || '/' || o_fy || '/' || lpad(o_seq::text, 6, '0');      -- 15 characters: inside the 16 the tax rules allow
END;
$$;
REVOKE ALL ON FUNCTION public._next_invoice_no(text, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.orders_issue_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_no text; v_fy text; v_seq integer;
  v_item text; v_buyer jsonb;
  v_paid timestamptz;
  v_rate integer;
BEGIN
  BEGIN
    IF NEW.status <> 'paid' OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.order_id = NEW.id AND i.kind = 'invoice') THEN
      RETURN NEW;
    END IF;
    v_paid := COALESCE((SELECT min(p.created_at) FROM public.payments p WHERE p.order_id = NEW.id AND p.status = 'captured'), now());
    SELECT COALESCE(pr.name, pl.name, NEW.kind) INTO v_item
      FROM (SELECT 1) one
      LEFT JOIN public.products pr ON pr.code = to_jsonb(NEW) ->> 'product_code'
      LEFT JOIN public.plans pl ON pl.code = NEW.plan_code;
    SELECT jsonb_build_object('id', pf.id, 'name', COALESCE(pf.full_name, pf.username), 'username', pf.username) INTO v_buyer
      FROM public.profiles pf WHERE pf.id = NEW.buyer_id;
    v_rate := COALESCE(NULLIF(public.finance_setting('tax_rate_bps'), '')::integer, 0);
    SELECT * INTO v_no, v_fy, v_seq FROM public._next_invoice_no('invoice', v_paid);
    INSERT INTO public.invoices (kind, invoice_no, fy, seq, order_id, issued_at, currency, taxable_minor, tax_minor, total_minor,
                                 tax_rate_bps, tax_label, sac_code, supplier, buyer, lines)
    VALUES ('invoice', v_no, v_fy, v_seq, NEW.id, v_paid, NEW.currency, NEW.amount_minor, NEW.tax_minor, NEW.amount_minor + NEW.tax_minor,
            CASE WHEN NEW.tax_minor > 0 THEN v_rate ELSE 0 END, public.finance_setting('tax_label'), public.finance_setting('sac_code'),
            jsonb_build_object('legal_name', public.finance_setting('company_legal_name'), 'gstin', public.finance_setting('company_gstin'),
                               'address', public.finance_setting('company_address'), 'state_code', public.finance_setting('company_state_code'),
                               'pan', public.finance_setting('company_pan')),
            COALESCE(v_buyer, '{}'::jsonb),
            jsonb_build_array(jsonb_build_object('description', COALESCE(v_item, NEW.kind), 'quantity', 1, 'amount_minor', NEW.amount_minor)))
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'orders_issue_invoice skipped for order %: %', NEW.id, SQLERRM;     -- an invoice problem must never stop a payment
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.orders_issue_invoice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS orders_issue_invoice ON public.orders;
CREATE TRIGGER orders_issue_invoice AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW WHEN (NEW.status = 'paid') EXECUTE FUNCTION public.orders_issue_invoice();

CREATE OR REPLACE FUNCTION public.refunds_issue_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_no text; v_fy text; v_seq integer;
  v_tax integer;
BEGIN
  BEGIN
    IF NEW.status <> 'processed' OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.refund_id = NEW.id AND i.kind = 'credit_note') THEN
      RETURN NEW;
    END IF;
    SELECT * INTO v_inv FROM public.invoices i WHERE i.order_id = NEW.order_id AND i.kind = 'invoice';
    IF NOT FOUND THEN RETURN NEW; END IF;
    v_tax := CASE WHEN v_inv.total_minor > 0 THEN round(NEW.amount_minor::numeric * v_inv.tax_minor / v_inv.total_minor)::integer ELSE 0 END;
    SELECT * INTO v_no, v_fy, v_seq FROM public._next_invoice_no('credit_note', now());
    INSERT INTO public.invoices (kind, invoice_no, fy, seq, order_id, related_invoice_id, refund_id, currency, taxable_minor, tax_minor, total_minor,
                                 tax_rate_bps, tax_label, sac_code, supplier, buyer, lines)
    VALUES ('credit_note', v_no, v_fy, v_seq, NEW.order_id, v_inv.id, NEW.id, v_inv.currency, NEW.amount_minor - v_tax, v_tax, NEW.amount_minor,
            v_inv.tax_rate_bps, v_inv.tax_label, v_inv.sac_code, v_inv.supplier, v_inv.buyer,
            jsonb_build_array(jsonb_build_object('description', 'Refund against ' || v_inv.invoice_no, 'quantity', 1, 'amount_minor', NEW.amount_minor - v_tax)))
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refunds_issue_credit_note skipped for refund %: %', NEW.id, SQLERRM;     -- never stops a refund
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refunds_issue_credit_note() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS refunds_issue_credit_note ON public.refunds;
CREATE TRIGGER refunds_issue_credit_note AFTER INSERT OR UPDATE OF status ON public.refunds
  FOR EACH ROW WHEN (NEW.status = 'processed') EXECUTE FUNCTION public.refunds_issue_credit_note();

-- 4. what a buyer can read -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_invoice_numbers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('order_id', i.order_id, 'invoice_no', i.invoice_no, 'kind', i.kind, 'issued_at', i.issued_at,
                                               'total_minor', i.total_minor) ORDER BY i.issued_at DESC), '[]'::jsonb)
  FROM public.invoices i JOIN public.orders o ON o.id = i.order_id
  WHERE o.buyer_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_invoice_numbers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invoice_numbers() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_invoice(p_order uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN inv.id IS NULL THEN NULL ELSE jsonb_build_object(
    'invoice_no', inv.invoice_no, 'issued_at', inv.issued_at, 'currency', inv.currency,
    'taxable_minor', inv.taxable_minor, 'tax_minor', inv.tax_minor, 'total_minor', inv.total_minor,
    'tax_rate_bps', inv.tax_rate_bps, 'tax_label', inv.tax_label, 'sac_code', inv.sac_code,
    'supplier', inv.supplier, 'buyer', inv.buyer, 'lines', inv.lines,
    'credit_notes', COALESCE((SELECT jsonb_agg(jsonb_build_object('invoice_no', c.invoice_no, 'issued_at', c.issued_at, 'total_minor', c.total_minor,
                                                                  'taxable_minor', c.taxable_minor, 'tax_minor', c.tax_minor) ORDER BY c.issued_at)
                              FROM public.invoices c WHERE c.related_invoice_id = inv.id AND c.kind = 'credit_note'), '[]'::jsonb)) END
  FROM (SELECT 1) one
  LEFT JOIN public.orders o ON o.id = p_order AND o.buyer_id = auth.uid()
  LEFT JOIN public.invoices inv ON inv.order_id = o.id AND inv.kind = 'invoice'
$$;
REVOKE ALL ON FUNCTION public.my_invoice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_invoice(uuid) TO authenticated;

-- 5. finance report for the super admin (read only; each view is written to the audit ledger) ---------------------
CREATE OR REPLACE FUNCTION public.staff_finance_report(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz; v_to timestamptz;
  v_out jsonb;
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only a super admin can see the finance report'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN RAISE EXCEPTION 'Choose a start date and an end date after it'; END IF;
  IF p_to - p_from > 400 THEN RAISE EXCEPTION 'Choose a range of at most 400 days'; END IF;
  v_from := (p_from::timestamp AT TIME ZONE 'Asia/Kolkata');
  v_to := ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Kolkata');

  v_out := jsonb_build_object(
    'from', p_from, 'to', p_to,
    'orders_by_status', (SELECT COALESCE(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
                          FROM (SELECT status, count(*) AS n FROM public.orders WHERE created_at >= v_from AND created_at < v_to GROUP BY status) x),
    'sales', (SELECT jsonb_build_object(
                'paid_orders', count(*),
                'net_minor', COALESCE(sum(o.amount_minor), 0),
                'tax_minor', COALESCE(sum(o.tax_minor), 0),
                'fee_minor', COALESCE(sum(o.fee_minor), 0),
                'gross_minor', COALESCE(sum(o.amount_minor + o.tax_minor), 0))
              FROM public.orders o
              WHERE o.status IN ('paid', 'fulfilled', 'settled', 'refunded', 'partially_refunded', 'disputed')
                AND EXISTS (SELECT 1 FROM public.payments p WHERE p.order_id = o.id AND p.status = 'captured' AND p.created_at >= v_from AND p.created_at < v_to)),
    'refunds', (SELECT jsonb_build_object('count', count(*), 'amount_minor', COALESCE(sum(r.amount_minor), 0))
                FROM public.refunds r WHERE r.status = 'processed' AND r.created_at >= v_from AND r.created_at < v_to),
    'refunds_waiting', (SELECT count(*) FROM public.refunds r WHERE r.status IN ('requested', 'approved', 'processing')),
    'disputes_open', (SELECT count(*) FROM public.disputes d WHERE d.status IN ('open', 'under_review')),
    'invoices_issued', (SELECT jsonb_build_object('invoices', count(*) FILTER (WHERE kind = 'invoice'), 'credit_notes', count(*) FILTER (WHERE kind = 'credit_note'))
                        FROM public.invoices i WHERE i.issued_at >= v_from AND i.issued_at < v_to),
    'ledger', (SELECT COALESCE(jsonb_agg(jsonb_build_object('account', regexp_replace(l.account, '^(seller_payable):.*$', '\1'), 'debit_minor', l.debit, 'credit_minor', l.credit) ORDER BY l.account), '[]'::jsonb)
               FROM (SELECT regexp_replace(account, '^(seller_payable):.*$', '\1') AS account,
                            COALESCE(sum(amount_minor) FILTER (WHERE direction = 'debit'), 0) AS debit,
                            COALESCE(sum(amount_minor) FILTER (WHERE direction = 'credit'), 0) AS credit
                     FROM public.ledger_entries WHERE created_at >= v_from AND created_at < v_to GROUP BY 1) l),
    'ledger_balance', (SELECT jsonb_build_object(
                         'groups', count(*),
                         'unbalanced', count(*) FILTER (WHERE g.debit <> g.credit),
                         'balanced', COALESCE(bool_and(g.debit = g.credit), true))
                       FROM (SELECT entry_group,
                                    COALESCE(sum(amount_minor) FILTER (WHERE direction = 'debit'), 0) AS debit,
                                    COALESCE(sum(amount_minor) FILTER (WHERE direction = 'credit'), 0) AS credit
                             FROM public.ledger_entries GROUP BY entry_group) g),
    'settings_ready', jsonb_build_object(
      'company_legal_name', public.finance_setting('company_legal_name') IS NOT NULL,
      'company_gstin', public.finance_setting('company_gstin') IS NOT NULL,
      'company_address', public.finance_setting('company_address') IS NOT NULL,
      'tax_rate_bps', COALESCE(NULLIF(public.finance_setting('tax_rate_bps'), '')::integer, 0))
  );

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.finance_report_viewed', auth.uid(), p_from::text || '..' || p_to::text, 'finance_report', 'Finance report viewed', jsonb_build_object('from', p_from, 'to', p_to));
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_finance_report(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_finance_report(date, date) TO authenticated;

-- 6. company and tax details (super admin; a reason is required; every change is audited) ------------------------
CREATE OR REPLACE FUNCTION public.staff_set_finance_details(p_values jsonb, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text; v_val text;
  v_allowed text[] := ARRAY['tax_rate_bps', 'tax_label', 'invoice_prefix', 'company_legal_name', 'company_gstin', 'company_address', 'company_state_code', 'company_pan', 'sac_code'];
  v_changed text[] := ARRAY[]::text[];
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only a super admin can change company and tax details'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  IF COALESCE(char_length(btrim(p_reason)), 0) < 5 THEN RAISE EXCEPTION 'Give a reason of at least a few words'; END IF;
  IF p_values IS NULL OR jsonb_typeof(p_values) <> 'object' THEN RAISE EXCEPTION 'Nothing to save'; END IF;

  FOR v_key, v_val IN SELECT k, NULLIF(btrim(p_values ->> k), '') FROM jsonb_object_keys(p_values) k LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN RAISE EXCEPTION 'Unknown setting %', v_key; END IF;
    IF v_key = 'tax_rate_bps' AND (v_val IS NULL OR v_val !~ '^[0-9]{1,4}$' OR v_val::integer > 2800) THEN RAISE EXCEPTION 'The tax rate must be a number from 0 to 2800 (1800 = 18%%)'; END IF;
    IF v_key = 'company_gstin' AND v_val IS NOT NULL AND upper(v_val) !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' THEN RAISE EXCEPTION 'That is not a valid GSTIN (15 characters)'; END IF;
    IF v_key = 'company_pan' AND v_val IS NOT NULL AND upper(v_val) !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN RAISE EXCEPTION 'That is not a valid PAN (10 characters)'; END IF;
    IF v_key = 'company_state_code' AND v_val IS NOT NULL AND v_val !~ '^[0-9]{2}$' THEN RAISE EXCEPTION 'The state code is two digits, for example 36'; END IF;
    IF v_key = 'invoice_prefix' AND (v_val IS NULL OR upper(v_val) !~ '^[A-Z0-9]{1,3}$') THEN RAISE EXCEPTION 'The invoice prefix is 1 to 3 letters or digits (the whole number may be 16 characters at most)'; END IF;
    IF v_key = 'tax_label' AND v_val IS NULL THEN RAISE EXCEPTION 'The tax name cannot be empty'; END IF;

    INSERT INTO public.platform_settings (key, value)
    VALUES (v_key, CASE WHEN v_val IS NULL THEN 'null'::jsonb
                        WHEN v_key = 'tax_rate_bps' THEN to_jsonb(v_val::integer)
                        WHEN v_key IN ('company_gstin', 'company_pan', 'invoice_prefix') THEN to_jsonb(upper(v_val))
                        ELSE to_jsonb(v_val) END)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    v_changed := v_changed || v_key;
  END LOOP;

  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES ('billing.finance_details_changed', auth.uid(), 'finance_details', 'settings', left(btrim(p_reason), 300), jsonb_build_object('changed', v_changed));
  RETURN jsonb_build_object('changed', v_changed);
END;
$$;
REVOKE ALL ON FUNCTION public.staff_set_finance_details(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_finance_details(jsonb, text) TO authenticated;

-- 7. the finance details a super admin sees in the form (read only)
CREATE OR REPLACE FUNCTION public.staff_get_finance_details()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.staff_rank(auth.uid()) < 3 THEN RAISE EXCEPTION 'Only a super admin can see this'; END IF;
  IF NOT public.staff_mfa_ok() THEN RAISE EXCEPTION 'Two-step sign-in is required for this action'; END IF;
  RETURN jsonb_build_object(
    'tax_rate_bps', COALESCE(NULLIF(public.finance_setting('tax_rate_bps'), '')::integer, 0),
    'tax_label', public.finance_setting('tax_label'), 'invoice_prefix', public.finance_setting('invoice_prefix'),
    'company_legal_name', public.finance_setting('company_legal_name'), 'company_gstin', public.finance_setting('company_gstin'),
    'company_address', public.finance_setting('company_address'), 'company_state_code', public.finance_setting('company_state_code'),
    'company_pan', public.finance_setting('company_pan'), 'sac_code', public.finance_setting('sac_code'));
END;
$$;
REVOKE ALL ON FUNCTION public.staff_get_finance_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_get_finance_details() TO authenticated;

NOTIFY pgrst, 'reload schema';
