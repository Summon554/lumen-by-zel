GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.profiles, public.posts, public.comments, public.comment_likes, public.likes, public.follows, public.follow_requests, public.notifications TO service_role;