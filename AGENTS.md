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

## Neon chat rules
- New chats get a client-generated id and are inserted by the /api/chat handler on the first question; this removes a round trip before the answer starts.
- In the chat handler, start the AI stream as soon as the token is verified and run database bookkeeping alongside it; time-to-first-word is a product requirement.
- Speed per Neon model is tuned via reasoning effort in neon-models.server.ts; src/test/neon-speed.test.ts guards those settings.
- The /_authenticated guard reads the local session (getSession) to avoid a network call per navigation; the server verifies every request.
