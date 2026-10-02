ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text GENERATED ALWAYS AS (lower(split_part(coalesce(email,''),'@',1))) STORED;

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, name, username, bio, avatar_url, cover_url, account_type, is_founder, is_private, created_at, last_seen_at, default_story_privacy, default_note_privacy) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_private_profile()
RETURNS TABLE(id uuid, email text, birthdate date, is_minor boolean, guardian_email text, guardian_verified boolean, strikes integer, suspended_until timestamptz, deletion_requested_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email, p.birthdate, p.is_minor, p.guardian_email, p.guardian_verified, p.strikes, p.suspended_until, p.deletion_requested_at
  FROM public.profiles p WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_private_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, name text, email text, strikes integer, suspended_until timestamptz, is_founder boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.email, p.strikes, p.suspended_until, p.is_founder, p.created_at
  FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'admin')
  ORDER BY p.created_at DESC LIMIT 50;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;