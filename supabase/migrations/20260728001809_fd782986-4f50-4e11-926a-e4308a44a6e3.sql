
-- Comments: add parent_id for replies
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments(parent_id);

-- Profiles: add is_private
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Comment likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, comment_id)
);
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comment_likes viewable by authenticated" ON public.comment_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own comment_likes" ON public.comment_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own comment_likes" ON public.comment_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Follow requests
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  target_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_requests TO authenticated;
GRANT ALL ON public.follow_requests TO service_role;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_requests visible to involved" ON public.follow_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "requester inserts own request" ON public.follow_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "target updates own request" ON public.follow_requests
  FOR UPDATE TO authenticated USING (auth.uid() = target_id) WITH CHECK (auth.uid() = target_id);
CREATE POLICY "involved delete request" ON public.follow_requests
  FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);
