REVOKE ALL ON FUNCTION public.can_view_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid) TO service_role;