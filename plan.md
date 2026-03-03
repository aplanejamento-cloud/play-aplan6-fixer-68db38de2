

## Fix Build: Restore Project Structure

The build error occurs because the `src/` directory is empty. All source files (App.tsx, main.tsx, components/, pages/, hooks/, etc.) exist at the project root but the tooling expects them inside `src/`.

### What needs to happen

Move/recreate all source files into the `src/` directory so the build system can find them:

1. **Entry point** -- `src/main.tsx` (already referenced by index.html as `/src/main.tsx`)
2. **App root** -- `src/App.tsx`
3. **Styles** -- `src/index.css`, `src/App.css`
4. **All source folders** -- Move into `src/`:
   - `components/` (UI, admin, feed, home)
   - `contexts/`
   - `hooks/`
   - `integrations/`
   - `lib/`
   - `pages/`
   - `types/`
5. **Config files stay at root** -- `vite.config.ts`, `tsconfig.json`, `package.json`, `index.html`, `tailwind.config.ts`, etc. remain unchanged
6. **Other root files** -- `vite-env.d.ts` moves to `src/`

### Technical details

Since I cannot move files, I will recreate each file inside `src/` by reading its current content from the root and writing it to the correct `src/` path. The key files are:

- `src/main.tsx`
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `src/vite-env.d.ts`
- `src/lib/utils.ts`
- `src/contexts/AuthContext.tsx`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `src/integrations/lovable/index.ts`
- All files in `src/components/`, `src/hooks/`, `src/pages/`, `src/types/`

No changes to file contents are needed -- just placing them in the correct directory. This will immediately fix the build error and make the preview work.

