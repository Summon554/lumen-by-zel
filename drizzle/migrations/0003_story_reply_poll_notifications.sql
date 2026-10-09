ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['like','follow','follow_request','reaction','share','comment','comment_reply','comment_like','story_reply','poll_vote']));

CREATE OR REPLACE FUNCTION public.notify_story_reply() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quote_kind = 'story' AND NEW.sender_id <> NEW.receiver_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type) VALUES (NEW.receiver_id, NEW.sender_id, 'story_reply');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_story_reply() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_story_reply AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_story_reply();

CREATE OR REPLACE FUNCTION public.notify_poll_vote() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.stories WHERE id = NEW.story_id;
  IF owner IS NOT NULL AND owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type) VALUES (owner, NEW.user_id, 'poll_vote');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_poll_vote() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_poll_vote AFTER INSERT ON public.story_poll_votes FOR EACH ROW EXECUTE FUNCTION public.notify_poll_vote();

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;