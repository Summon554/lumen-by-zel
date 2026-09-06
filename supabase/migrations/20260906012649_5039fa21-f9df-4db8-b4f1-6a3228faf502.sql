CREATE TABLE public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_posts TO authenticated;
GRANT ALL ON public.saved_posts TO service_role;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own saves" ON public.saved_posts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users create own saves" ON public.saved_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own saves" ON public.saved_posts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX saved_posts_user_idx ON public.saved_posts (user_id, created_at DESC);

CREATE TABLE public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read message reactions" ON public.message_reactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()))
);
CREATE POLICY "Participants add own message reactions" ON public.message_reactions FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()))
);
CREATE POLICY "Users update own message reactions" ON public.message_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own message reactions" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX message_reactions_message_idx ON public.message_reactions (message_id);

ALTER TABLE public.messages
  ADD COLUMN reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN quote_kind text,
  ADD COLUMN quote_text text;

ALTER TABLE public.posts ADD COLUMN edited_at timestamptz;