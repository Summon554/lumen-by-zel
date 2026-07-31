CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.can_view_user(_target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _target
      AND (
        p.id = auth.uid()
        OR p.is_private = false
        OR EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = _target)
      )
  )
$function$;

REVOKE ALL ON FUNCTION private.can_view_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_view_user(uuid) TO authenticated, service_role;

DROP POLICY "Posts viewable when author visible" ON public.posts;
CREATE POLICY "Posts viewable when author visible" ON public.posts FOR SELECT TO authenticated
USING (private.can_view_user(user_id));

DROP POLICY "Likes viewable when post visible" ON public.likes;
CREATE POLICY "Likes viewable when post visible" ON public.likes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = likes.post_id AND private.can_view_user(p.user_id)));

DROP POLICY "Comments viewable when post visible" ON public.comments;
CREATE POLICY "Comments viewable when post visible" ON public.comments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = comments.post_id AND private.can_view_user(p.user_id)));

DROP POLICY "comment_likes viewable when post visible" ON public.comment_likes;
CREATE POLICY "comment_likes viewable when post visible" ON public.comment_likes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.comments c JOIN public.posts p ON p.id = c.post_id WHERE c.id = comment_likes.comment_id AND private.can_view_user(p.user_id)));

DROP POLICY "follows viewable when involved or visible" ON public.follows;
CREATE POLICY "follows viewable when involved or visible" ON public.follows FOR SELECT TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = following_id OR private.can_view_user(following_id) OR private.can_view_user(follower_id));

DROP POLICY "Lumen media readable when owner visible" ON storage.objects;
CREATE POLICY "Lumen media readable when owner visible" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lumen-media' AND ((storage.foldername(name))[1] = (auth.uid())::text OR private.can_view_user(((storage.foldername(name))[1])::uuid)));

DROP FUNCTION IF EXISTS public.can_view_user(uuid);