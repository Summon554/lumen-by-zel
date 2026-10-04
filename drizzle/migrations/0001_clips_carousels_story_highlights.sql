ALTER TABLE public.posts ADD COLUMN media_paths text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.posts ADD CONSTRAINT posts_media_paths_limit CHECK (cardinality(media_paths) <= 5);
CREATE TABLE public.story_highlights (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 40),
 cover_story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_highlights TO authenticated;
GRANT ALL ON public.story_highlights TO service_role;
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visible highlights" ON public.story_highlights FOR SELECT TO authenticated USING (user_id = auth.uid() OR private.can_view_user(user_id));
CREATE POLICY "owner inserts highlight" ON public.story_highlights FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND (cover_story_id IS NULL OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = cover_story_id AND s.user_id = auth.uid())));
CREATE POLICY "owner updates highlight" ON public.story_highlights FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND (cover_story_id IS NULL OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = cover_story_id AND s.user_id = auth.uid())));
CREATE POLICY "owner deletes highlight" ON public.story_highlights FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.story_highlight_items (
 highlight_id uuid NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
 story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
 position integer NOT NULL DEFAULT 0,
 PRIMARY KEY (highlight_id, story_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_highlight_items TO authenticated;
GRANT ALL ON public.story_highlight_items TO service_role;
ALTER TABLE public.story_highlight_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view highlight items" ON public.story_highlight_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id));
CREATE POLICY "owner adds own stories" ON public.story_highlight_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.story_highlights h JOIN public.stories s ON s.id = story_id AND s.user_id = h.user_id WHERE h.id = highlight_id AND h.user_id = auth.uid() AND s.held_for_moderation = false));
CREATE POLICY "owner removes highlight items" ON public.story_highlight_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.story_highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid()));
CREATE POLICY "highlighted stories retain their original audience" ON public.stories FOR SELECT TO authenticated USING (
 held_for_moderation = false AND EXISTS (
 SELECT 1 FROM public.story_highlight_items i JOIN public.story_highlights h ON h.id = i.highlight_id
 WHERE i.story_id = stories.id AND h.user_id = stories.user_id
 ) AND NOT private.is_blocked(auth.uid(), user_id) AND (
 user_id = auth.uid() OR privacy = 'public' OR
 (privacy = 'custom' AND auth.uid() = ANY(custom_audience)) OR
 (privacy = 'friends' AND EXISTS (SELECT 1 FROM public.follows f1 JOIN public.follows f2 ON f2.follower_id = user_id AND f2.following_id = auth.uid() WHERE f1.follower_id = auth.uid() AND f1.following_id = user_id)) OR
 (privacy = 'fof' AND EXISTS (SELECT 1 FROM public.follows a JOIN public.follows b ON b.follower_id = a.following_id WHERE a.follower_id = auth.uid() AND b.following_id = user_id))
 ));
CREATE INDEX story_highlights_user_idx ON public.story_highlights(user_id, created_at);
CREATE INDEX story_highlight_items_story_idx ON public.story_highlight_items(story_id);