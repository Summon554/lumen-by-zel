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
