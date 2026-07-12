# Git workflow

- Always push finished work directly to `master` (fast-forward, no PR) unless explicitly told otherwise for a specific change. This repo's default branch is `master`, not `main`.
- Before pushing to `master`, run `npx tsc --noEmit` and a full `npm run build` (with placeholder `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` for local builds) and make sure both are clean.
