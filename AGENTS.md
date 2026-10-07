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

## Frontend architecture
- Keep sanitized Stitch reference markup in client-safe JSON modules and render it through the shared React screen adapter; this preserves the authoritative seven-screen design without duplicating layouts.
- Use the shared adapter for demo interactions and the existing Button component for parsed controls; this keeps frontend-only workflows consistent without adding persistence.
- Give each of the seven screens a distinct TanStack file route and leaf metadata; this supports direct links and working navigation.
- Register all Stitch palette and typography roles in the CSS theme; this keeps reference appearance token-based.
