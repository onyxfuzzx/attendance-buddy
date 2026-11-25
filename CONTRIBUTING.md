# Contributing to Attendance Buddy

Thanks for helping make attendance a little easier for everyone.

## Start locally

Fork this repository, clone your fork, and use Node.js 24:

```sh
npm ci
npm run dev
```

The browser-local demo requires no account or database. Live development uses your own Supabase project; follow [the setup guide](docs/SETUP.md). Do not use the maintainers' test credentials or production data.

## Make a change

1. Open an issue for substantial behavior, schema, or architecture changes so the scope is clear.
2. Create a branch with a descriptive name.
3. Keep the change focused. Include useful regression coverage for behavior changes.
4. Run the appropriate checks:

   ```sh
   npm run build
   npm test
   npm run test:ui
   npm run build:pages
   npm run test:pages
   ```

   Local browser tests use Chrome. Set `CI=true` to use Playwright Chromium after running `npx playwright install chromium`. Website development is available through `npm run dev:website`; preview the complete static site and public demo with `npm run build:pages` followed by `npm run preview:pages`.

5. Open a pull request describing the problem, resulting behavior, and checks run. Include screenshots for visual changes and setup notes for schema changes.

## Project conventions

- Use TypeScript for app/API code and preserve the existing formatting.
- Keep database authorization in RLS and explicitly checked transactions, even when the UI hides an action.
- Add new migrations for database changes; do not rewrite migrations that users may already have applied.
- Keep the public Pages demo browser-local and independent of private Supabase configuration.
- Never commit `.env` files, seed passwords, user photos, attendance exports, or private keys.
- Report security issues using [SECURITY.md](SECURITY.md).

Contributions are provided under the project's [MIT license](LICENSE). Please follow the [code of conduct](CODE_OF_CONDUCT.md).
