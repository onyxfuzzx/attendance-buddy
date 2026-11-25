# Project website and public demo

The public site is deployed at **https://onyxfuzzx.github.io/attendance-buddy/**. It introduces the project, links to the source and setup documentation, and includes a browser-local demo at `/attendance-buddy/demo/`.

## Local development

```sh
npm run dev:website
```

This serves the landing page at http://127.0.0.1:4174. To preview the complete GitHub Pages output, including the app demo:

```sh
npm run build:pages
npm run preview:pages
```

Open http://127.0.0.1:4174/attendance-buddy/.

## Publication

The repository uses `.github/workflows/pages.yml`. It builds the website and static demo, then publishes `dist/pages` using the official GitHub Pages actions. In repository **Settings → Pages**, the source must be **GitHub Actions**. The workflow runs for relevant changes pushed to `main` and can be started manually from Actions.

No Supabase or account secrets are required by this workflow. Repository permissions are limited to reading contents, writing Pages deployments, and requesting the deployment identity token.

The build derives the repository path from `GITHUB_REPOSITORY`, defaulting to `/attendance-buddy/` locally. For forks with a different repository name, use the workflow's resulting URL; set `BUDDY_BASE_PATH` to a slash-prefixed and slash-terminated path for custom local builds.

## Separation from the live application

The public demo is built with the `pages-demo` Vite mode. It ignores `.env` files, removes Supabase/API configuration, starts in demo mode, and saves only synthetic data in the visitor's browser. A post-build inspection checks that local Supabase URLs and keys are absent from public HTML, JavaScript, and other text assets.

GitHub Pages does not run the Express API. Deploy the authenticated application separately with your own Supabase project using [the setup guide](SETUP.md). Do not add secret keys or seeded account credentials to the Pages workflow.

Self-hosted DM Sans and Manrope font licenses are included in the published `licenses/` directory. Their original notices remain available in the installed packages.
