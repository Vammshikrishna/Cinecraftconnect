-- PART FH (projects) - make project invite links work. Safe to run more than once.
--
-- WHAT WAS WRONG (browser test): Team > Invite Link > "Generate Invite Link" showed "Failed to generate invite link", and even when a link could be
-- made it pointed at /projects/join/<code>, a page that did not exist. The project_invites table only existed in the archived migrations, not in
-- the live project, and nothing could redeem a code.
-- THE FIX: (1) the table, with row-level security (the project owner and admins create and delete invites, members can read them);
-- (2) join_project_by_invite(code): checks the code (exists, not expired, uses left), refuses fan and staff accounts, adds the caller as a
-- plain member and counts the use. The web app has a new page /projects/join/:code that calls it. Codes are now made with crypto random.
--
-- PREFLIGHT (read only): select to_regclass('public.project_invites');   -- null if the table is missing
-- POST-CHECK  (read only): as the owner generate a link; as another creator/studio account open it: you land in the project space.

CREATE TABLE IF NOT EXISTS public.project_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.project_spaces(id) ON DELETE CASCADE,
    invite_code text NOT NULL UNIQUE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at timestamptz,
    max_uses integer,
    used_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members can view invites" ON public.project_invites;
CREATE POLICY "Project members can view invites" ON public.project_invites FOR SELECT
  USING (public.cl_i_manage_space(project_id)
         OR EXISTS (SELECT 1 FROM public.project_space_members m WHERE m.project_space_id = project_invites.project_id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Project creators can create invites" ON public.project_invites;
CREATE POLICY "Project creators can create invites" ON public.project_invites FOR INSERT
  WITH CHECK (created_by = auth.uid() AND public.cl_i_manage_space(project_id));

DROP POLICY IF EXISTS "Project creators can delete invites" ON public.project_invites;
CREATE POLICY "Project creators can delete invites" ON public.project_invites FOR DELETE
  USING (public.cl_i_manage_space(project_id));

-- redeem a code
CREATE OR REPLACE FUNCTION public.join_project_by_invite(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_inv public.project_invites%ROWTYPE;
    v_project uuid;
    v_type text;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;

    SELECT * INTO v_inv FROM public.project_invites WHERE invite_code = p_code;
    IF NOT FOUND THEN RAISE EXCEPTION 'This invite link is not valid'; END IF;
    IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN RAISE EXCEPTION 'This invite link has expired'; END IF;
    IF v_inv.max_uses IS NOT NULL AND COALESCE(v_inv.used_count, 0) >= v_inv.max_uses THEN RAISE EXCEPTION 'This invite link has been used up'; END IF;

    SELECT account_type INTO v_type FROM public.profiles WHERE id = v_uid;
    IF v_type = 'fan' THEN RAISE EXCEPTION 'Fan accounts cannot join projects'; END IF;
    IF public.is_staff_user(v_uid) THEN RAISE EXCEPTION 'Staff accounts cannot join projects'; END IF;

    IF NOT EXISTS (SELECT 1 FROM public.project_space_members WHERE project_space_id = v_inv.project_id AND user_id = v_uid) THEN
        INSERT INTO public.project_space_members (project_space_id, user_id, role) VALUES (v_inv.project_id, v_uid, 'member');
        UPDATE public.project_invites SET used_count = COALESCE(used_count, 0) + 1, updated_at = now() WHERE id = v_inv.id;
    END IF;

    SELECT project_id INTO v_project FROM public.project_spaces WHERE id = v_inv.project_id;
    RETURN v_project;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_project_by_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_project_by_invite(text) TO authenticated, service_role;
