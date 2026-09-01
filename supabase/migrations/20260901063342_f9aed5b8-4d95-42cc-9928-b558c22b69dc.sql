DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='guardian_verifications' LOOP
    EXECUTE format('DROP POLICY %I ON public.guardian_verifications', p.policyname);
  END LOOP;
END $$;

REVOKE ALL ON public.guardian_verifications FROM authenticated, anon;
GRANT ALL ON public.guardian_verifications TO service_role;