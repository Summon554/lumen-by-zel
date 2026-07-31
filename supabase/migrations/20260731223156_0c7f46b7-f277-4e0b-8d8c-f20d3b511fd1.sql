DROP POLICY IF EXISTS "notifications require real action" ON public.notifications;
CREATE POLICY "notifications require real action" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = actor_id
  AND user_id <> actor_id
  AND (
    (type = 'follow' AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = actor_id AND f.following_id = user_id))
    OR (type = 'follow_request' AND EXISTS (SELECT 1 FROM public.follow_requests r WHERE r.requester_id = actor_id AND r.target_id = user_id))
    OR (type = 'like' AND EXISTS (
          SELECT 1 FROM public.likes l JOIN public.posts p ON p.id = l.post_id
          WHERE l.user_id = actor_id AND l.post_id = notifications.post_id AND p.user_id = notifications.user_id))
    OR (type = 'comment' AND EXISTS (
          SELECT 1 FROM public.comments c JOIN public.posts p ON p.id = c.post_id
          WHERE c.user_id = actor_id AND c.post_id = notifications.post_id AND p.user_id = notifications.user_id))
    OR (type = 'comment_reply' AND EXISTS (
          SELECT 1 FROM public.comments c JOIN public.comments parent ON parent.id = c.parent_id
          WHERE c.user_id = actor_id AND c.post_id = notifications.post_id AND parent.user_id = notifications.user_id))
    OR (type = 'comment_like' AND EXISTS (
          SELECT 1 FROM public.comment_likes cl JOIN public.comments c ON c.id = cl.comment_id
          WHERE cl.user_id = actor_id AND c.post_id = notifications.post_id AND c.user_id = notifications.user_id))
  )
);

DROP POLICY IF EXISTS "Lumen media readable by authenticated" ON storage.objects;
CREATE POLICY "Lumen media readable when owner visible" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'lumen-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.can_view_user(((storage.foldername(name))[1])::uuid)
  )
);