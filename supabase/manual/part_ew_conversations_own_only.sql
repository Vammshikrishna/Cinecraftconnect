-- PART EW - a person can only list THEIR OWN conversations; two internal helpers become server-only. Safe to run more than once. Any time.
--
-- WHAT THE PREFLIGHT SHOWED (audit_step_ew_preflight.sql):
--   1. get_user_conversations_with_profiles(p_user_id) never compared p_user_id with the caller, so any signed-in person could pass someone
--      else's id and read that person's conversation list (other person's name, last message text, unread counts).
--      All four callers (web Messages, web / mobile share sheet, mobile MessagesListScreen) pass their own id, so nothing changes for them.
--      The function body is not rewritten: the live definition is read with pg_get_functiondef and one guard line is added after its first BEGIN.
--      Service-role calls (no auth.uid()) are still allowed.
--   2. refundable_minor(order) and report_due_interval(priority) are only used inside other SECURITY DEFINER functions. Signed-in users could
--      call them directly (refundable_minor reveals what can still be refunded on any order id). Execute is revoked unless a policy, view,
--      default, constraint or a non-definer function depends on them (then it is skipped and printed as NOTICE).
--   Left alone on purpose: has_role, staff_rank, is_staff_user, is_page_manager, is_room_admin, is_room_creator, has_active_staff_grant,
--   is_staff_observer, cj_room_is_public, billing_setting_int. Row-level-security policies run as the caller and call them.
--
-- POST-CHECK (read only): select prosrc like '%your own conversations%' as guarded from pg_proc where proname = 'get_user_conversations_with_profiles';  -- true
--   select count(*) from pg_proc where proname in ('refundable_minor','report_due_interval') and has_function_privilege('authenticated', oid, 'EXECUTE');  -- 0 (or fewer than 2 if NOTICE says kept)
-- ROLLBACK 1: re-create the function from the migration file without the guard line (the guard is the 3 lines after the first BEGIN).
-- ROLLBACK 2: grant execute on function public.<name>(<args>) to authenticated;

-- 1. conversations: own id only
DO $$
DECLARE
  r record;
  def text;
  patched text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_conversations_with_profiles' AND p.prokind = 'f'
  LOOP
    def := pg_get_functiondef(r.oid);
    IF def LIKE '%your own conversations%' THEN
      RAISE NOTICE 'already guarded: %', r.oid::regprocedure;
      CONTINUE;
    END IF;
    patched := regexp_replace(
      def,
      '\mBEGIN\M',
      E'BEGIN\n  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN\n    RAISE EXCEPTION ''You can only list your own conversations'';\n  END IF;',
      'i'   -- no ''g'': only the first BEGIN
    );
    IF patched = def THEN
      RAISE EXCEPTION 'could not patch %, no BEGIN found', r.oid::regprocedure;
    END IF;
    EXECUTE patched;
  END LOOP;
END $$;

-- 2. internal helpers become server-only
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname IN ('refundable_minor', 'report_due_interval')
  LOOP
    IF EXISTS (SELECT 1 FROM pg_policies pol
               WHERE (coalesce(pol.qual,'') || ' ' || coalesce(pol.with_check,'')) ~ ('\m' || r.proname || '\M'))
       OR EXISTS (SELECT 1 FROM pg_depend d
                  WHERE d.refobjid = r.oid AND d.deptype IN ('n','a')
                    AND d.classid IN ('pg_attrdef'::regclass, 'pg_constraint'::regclass, 'pg_trigger'::regclass, 'pg_rewrite'::regclass, 'pg_class'::regclass, 'pg_policy'::regclass))
       OR EXISTS (SELECT 1 FROM pg_proc p2 JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
                  WHERE n2.nspname = 'public' AND p2.oid <> r.oid AND p2.prokind = 'f' AND NOT p2.prosecdef
                    AND p2.prosrc ~ ('\m' || r.proname || '\M'))
    THEN
      RAISE NOTICE 'kept (something still needs it): %', r.sig;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
