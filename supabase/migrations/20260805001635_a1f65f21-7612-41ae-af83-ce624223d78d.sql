-- 1. Profiles: age, guardian, strikes, suspension, deletion window
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS strikes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

-- 2. Consent records
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_kind text NOT NULL CHECK (doc_kind IN ('terms','privacy','data_privacy_act')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_kind, version)
);
GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consents select" ON public.user_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own consents insert" ON public.user_consents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. Guardian verification tokens
CREATE TABLE IF NOT EXISTS public.guardian_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guardian_email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guardian_verifications_user_idx ON public.guardian_verifications(user_id);
GRANT SELECT ON public.guardian_verifications TO authenticated;
GRANT ALL ON public.guardian_verifications TO service_role;
ALTER TABLE public.guardian_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own guardian rows" ON public.guardian_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 4. Moderation flags
CREATE TABLE IF NOT EXISTS public.moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post','comment','message','story','note','profile')),
  content_id uuid,
  categories text[] NOT NULL DEFAULT '{}',
  excerpt text,
  action text NOT NULL DEFAULT 'blocked',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.moderation_flags TO authenticated;
GRANT ALL ON public.moderation_flags TO service_role;
ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log own moderation flag" ON public.moderation_flags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 5. Strikes
CREATE TABLE IF NOT EXISTS public.strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS strikes_user_idx ON public.strikes(user_id);
GRANT SELECT ON public.strikes TO authenticated;
GRANT ALL ON public.strikes TO service_role;
ALTER TABLE public.strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own strikes" ON public.strikes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 6. Appeals
CREATE TABLE IF NOT EXISTS public.appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strike_id uuid REFERENCES public.strikes(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT ON public.appeals TO authenticated;
GRANT ALL ON public.appeals TO service_role;
ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own appeals select" ON public.appeals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own appeals insert" ON public.appeals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 7. Takedown requests (public form)
CREATE TABLE IF NOT EXISTS public.takedown_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  content_url text,
  work_title text NOT NULL,
  rights_statement text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','denied')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.takedown_requests TO authenticated, anon;
GRANT ALL ON public.takedown_requests TO service_role;
ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit takedown" ON public.takedown_requests FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "own takedowns select" ON public.takedown_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id);

-- 8. Reports: generic target + resolution status
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS content_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE INDEX IF NOT EXISTS reports_target_idx ON public.reports(content_type, content_id);
