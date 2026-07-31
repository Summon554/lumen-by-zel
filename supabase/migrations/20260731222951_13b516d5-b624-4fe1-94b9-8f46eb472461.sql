-- Founder flag (replaces reading emails client-side)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false;
UPDATE public.profiles SET is_founder = true WHERE lower(email) = 'winzelestorninos4@gmail.com';

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, name, bio, avatar_url, is_private, is_founder, created_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Visibility helper
CREATE OR REPLACE FUNCTION public.can_view_user(_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _target
      AND (
        p.id = auth.uid()
        OR p.is_private = false
        OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = _target)
      )
  )
$$;

DROP POLICY IF EXISTS "Posts viewable by authenticated" ON public.posts;
CREATE POLICY "Posts viewable when author visible" ON public.posts
FOR SELECT TO authenticated USING (public.can_view_user(user_id));

DROP POLICY IF EXISTS "Likes viewable by authenticated" ON public.likes;
CREATE POLICY "Likes viewable when post visible" ON public.likes
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = likes.post_id AND public.can_view_user(p.user_id))
);

DROP POLICY IF EXISTS "Comments viewable by authenticated" ON public.comments;
CREATE POLICY "Comments viewable when post visible" ON public.comments
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND public.can_view_user(p.user_id))
);

DROP POLICY IF EXISTS "comment_likes viewable by authenticated" ON public.comment_likes;
CREATE POLICY "comment_likes viewable when post visible" ON public.comment_likes
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.posts p ON p.id = c.post_id
    WHERE c.id = comment_likes.comment_id AND public.can_view_user(p.user_id)
  )
);

DROP POLICY IF EXISTS "follows viewable by authenticated" ON public.follows;
CREATE POLICY "follows viewable when involved or visible" ON public.follows
FOR SELECT TO authenticated USING (
  auth.uid() = follower_id
  OR auth.uid() = following_id
  OR public.can_view_user(following_id)
  OR public.can_view_user(follower_id)
);

-- Block fake notifications
DROP POLICY IF EXISTS "authenticated create notifications" ON public.notifications;
CREATE POLICY "notifications require real action" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = actor_id
  AND user_id <> actor_id
  AND (
    (type IN ('follow') AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = actor_id AND f.following_id = user_id))
    OR (type IN ('follow_request') AND EXISTS (SELECT 1 FROM public.follow_requests r WHERE r.requester_id = actor_id AND r.target_id = user_id))
    OR (type IN ('like') AND EXISTS (SELECT 1 FROM public.likes l WHERE l.user_id = actor_id AND l.post_id = notifications.post_id))
    OR (type IN ('comment', 'comment_reply') AND EXISTS (SELECT 1 FROM public.comments c WHERE c.user_id = actor_id AND c.post_id = notifications.post_id))
    OR (type IN ('comment_like') AND EXISTS (
          SELECT 1 FROM public.comment_likes cl JOIN public.comments c ON c.id = cl.comment_id
          WHERE cl.user_id = actor_id AND c.post_id = notifications.post_id))
  )
);