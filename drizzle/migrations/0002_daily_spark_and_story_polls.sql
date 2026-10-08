ALTER TABLE public.posts ADD COLUMN spark_day date;
CREATE INDEX posts_spark_day_idx ON public.posts(spark_day) WHERE spark_day IS NOT NULL;
CREATE OR REPLACE FUNCTION public.current_daily_spark()
RETURNS TABLE(spark_day date, question text)
LANGUAGE sql STABLE SET search_path = public AS $$
 SELECT (now() AT TIME ZONE 'Asia/Manila')::date,
 (ARRAY['What made you smile today?','Who deserves a little appreciation today?','Share a small win that means a lot to you.','What is something beautiful you noticed today?','What helps you recharge?','Share a memory that still makes you smile.','What are you looking forward to?','What kindness did you give or receive today?','Show us your favorite corner of the world.','What is one thing you are grateful for?','What inspired you to keep going today?','Share something you created.','What song matches your mood today?','What would you tell your younger self?'])[(mod(((now() AT TIME ZONE 'Asia/Manila')::date - DATE '2026-01-01'),14)+14)%14+1];
$$;
REVOKE ALL ON FUNCTION public.current_daily_spark() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_daily_spark() TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.validate_spark_response() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.spark_day IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.spark_day IS DISTINCT FROM OLD.spark_day) AND NEW.spark_day <> (now() AT TIME ZONE 'Asia/Manila')::date THEN RAISE EXCEPTION 'Respond to today''s Spark only'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_spark_response BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.validate_spark_response();
CREATE TABLE public.story_poll_votes (
 story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 option_index smallint NOT NULL CHECK (option_index IN (0,1)),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(story_id,user_id)
);
GRANT SELECT, INSERT ON public.story_poll_votes TO authenticated;
GRANT ALL ON public.story_poll_votes TO service_role;
ALTER TABLE public.story_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible story poll results" ON public.story_poll_votes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id));
CREATE POLICY "One vote on visible active polls" ON public.story_poll_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.expires_at > now() AND NOT s.archived AND NOT s.held_for_moderation AND s.user_id <> auth.uid() AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.stickers) AS sticker WHERE sticker->>'kind' = 'poll' AND jsonb_array_length(sticker->'options') = 2)));
CREATE OR REPLACE FUNCTION public.story_poll_results(p_story_id uuid) RETURNS TABLE(option_index smallint, votes bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$ SELECT v.option_index, count(*) FROM public.story_poll_votes v WHERE v.story_id = p_story_id GROUP BY v.option_index; $$;
REVOKE ALL ON FUNCTION public.story_poll_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.story_poll_results(uuid) TO authenticated, service_role;
