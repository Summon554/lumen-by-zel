
-- Profiles enhancements
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow authenticated users to view all profiles (needed for feed/comments display)
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- POSTS
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by authenticated" ON public.posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own posts" ON public.posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts" ON public.posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own posts" ON public.posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX posts_user_id_idx ON public.posts(user_id);
CREATE INDEX posts_created_at_idx ON public.posts(created_at DESC);

-- LIKES
CREATE TABLE public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by authenticated" ON public.likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own likes" ON public.likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON public.likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX likes_post_id_idx ON public.likes(post_id);

-- COMMENTS
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by authenticated" ON public.comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own comments" ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments" ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX comments_post_id_idx ON public.comments(post_id);

-- Storage policies for lumen-media bucket (private bucket; users manage own folder)
CREATE POLICY "Lumen media readable by authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'lumen-media');
CREATE POLICY "Lumen media insert own folder" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'lumen-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Lumen media update own folder" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'lumen-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Lumen media delete own folder" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'lumen-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );
