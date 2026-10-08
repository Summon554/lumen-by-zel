<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store carousel media paths on posts while preserving the original image URL for older readers; this keeps existing posts and consumers compatible.
- Store highlights as owner-scoped collections of existing story IDs and enforce original story audiences for expired stories; this prevents highlights from widening story privacy.
- Resolve the daily Spark date and curated question in the database using Manila time, and link responses through posts.spark_day; this keeps all clients on the same community day without scheduled jobs.
- Store immutable poll votes by story and voter with a composite primary key and story-audience RLS; this prevents duplicate voting and audience leaks.
- Generate QR codes and Glow Card PNG exports locally from safe profile fields; this avoids external QR services and preserves profile privacy.
