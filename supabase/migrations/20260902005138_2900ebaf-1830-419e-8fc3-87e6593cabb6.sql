-- Allow comment authors to edit their own comment text
CREATE POLICY "Users update own comments"
ON public.comments
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Guardian verification tokens: make the locked-down intent explicit
REVOKE ALL ON public.guardian_verifications FROM anon, authenticated;
GRANT ALL ON public.guardian_verifications TO service_role;
ALTER TABLE public.guardian_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_verifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to guardian verifications" ON public.guardian_verifications;
CREATE POLICY "No client access to guardian verifications"
ON public.guardian_verifications
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

COMMENT ON TABLE public.guardian_verifications IS 'Sensitive guardian verification tokens. Deliberately inaccessible to anon/authenticated; only server-side (service_role) code may read or write.';