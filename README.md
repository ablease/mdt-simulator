# Revision MDT Simulator

A research prototype that simulates a UK NHS multidisciplinary team meeting for complex and revision hip and knee arthroplasty. Several AI "consultants" give first opinions on a case, discuss each other's views for one or two rounds, and an AI chair records the outcome. The output is simulated and is not clinical advice.

It runs at **<https://mdt.ablease.co.uk>**. There is no server: the browser calls OpenAI and Anthropic directly with the user's own API keys. The plain-English guide for clinical users is [USER-GUIDE.md](USER-GUIDE.md), and the development brief is [docs/brief.md](docs/brief.md).

## Running it locally

You need Node 26 (see `.nvmrc`).

```sh
npm ci
npm run dev        # http://localhost:5173
```

The dev server doesn't apply the Content Security Policy, because Vite's hot reload injects inline styles the policy would block. To try the real thing, run `npm run build && npm run preview` and open <http://localhost:4173>.

## Tests

```sh
npx playwright install chromium   # once
npm test                          # unit tests, then end-to-end tests
npm run test:unit                 # Vitest only, under a second
npm run test:e2e                  # Playwright only, builds the site first
```

The end-to-end tests run against the production build, so the security policy is in force. They replace `api.openai.com` and `api.anthropic.com` with mocks that stream answers in each provider's real event format, so no keys or credit are needed. They cover a full meeting across both providers, stopping midway, a rejected key, a rate limit followed by a retry, the PDF and JSON downloads, the key check, the passphrase lock and the migration of older saved settings. For images, they upload real JPEG and PNG files with a patient's name planted in the EXIF data, a JPEG comment and a PNG text chunk, and check that none of it, nor the file name, reaches the provider or the exports. They also check downscaling, EXIF rotation, black-out boxes burned into the pixels, the checklist, refused file types, and a model that can't read images. The layout tests check that every page shows the research-only notice, that the four set-up steps work from the keyboard, that the review step links to whatever needs fixing, that a meeting keeps running while you look at other pages, and that nothing overflows sideways at tablet and phone widths. Every run also asserts that the page contacted nobody except itself and the two providers.

`tests/e2e/parity.spec.ts` runs the same meetings through the original single-file app in `legacy/index.html` and through the new build, with the clock frozen, and checks that the request bodies, on-screen transcript, JSON file and PDF file are identical. It saves side-by-side screenshots in `test-results/parity/`. The test helpers in `tests/support/app.ts` click through the new app's pages and steps, and do nothing extra on the original, which has everything on one page. Feature 2 changes the JSON on purpose, so the test and `legacy/` go then.

## Prompts

The prompt wording has been tested with the clinical user, so it's frozen by snapshot tests in `tests/unit/prompts.test.ts`. If you change a prompt, a role brief or a built-in case, that test fails and shows the difference. The image prompts in `src/prompts/prompts.ts` were agreed on 21 November 2026 and are frozen the same way. Without images, none of them are used and every prompt is exactly as it was. Agree the change first, then update the snapshot with `npx vitest run -u`.

## How it's put together

| Folder | What's in it |
|---|---|
| `src/providers/` | One file per AI provider behind a common `Provider` interface: list models, stream an answer. Messages are passed as content parts so images can be added without touching the UI. |
| `src/prompts/` | The shared framing, the seats at the table, the three prompt templates and the imaging review prompt. |
| `src/images/` | Checks the file type from its first bytes, shrinks images to 1,568 px on the long edge, redraws them through a canvas as JPEG (which drops all metadata) and burns in black-out boxes. |
| `src/meeting/` | The meeting engine: an imaging review when images are attached, first opinions in parallel, discussion rounds, the chair, retries and stopping. It publishes a view of the meeting that React renders, and builds the record that gets downloaded. |
| `src/storage/` | Saved settings in `localStorage`, and the passphrase-locked key store. |
| `src/export/` | JSON and PDF downloads. The PDF uses pdfmake 0.2.7, served from this site. |
| `src/ui/` | React components. `App.tsx` lays out the slim notice bar, the sidebar, the page and, on the meeting page, the case and panel. `route.ts` maps the part of the address after `#` to a page, so GitHub Pages can serve every page from `index.html`. `useDraft.ts` holds the meeting being set up, `readiness.ts` decides whether it can run, and `pages/` has one component per page. |

## Security and privacy

Case text only ever goes to the AI provider the user picks. Beyond that:

- **Own address.** Browsers keep saved data separate per site address. The app lives on its own subdomain so that no other site on `ablease.github.io` or `ablease.co.uk` can read what it stores.
- **No third-party requests.** Fonts and pdfmake are bundled with the site, so the page only contacts itself and the two providers.
- **Content Security Policy.** A `<meta>` tag added at build time (`vite.config.ts`) only lets the page load its own files and only connect to `api.openai.com` and `api.anthropic.com`. Trusted Types are required for script URLs, and the only policy allowed to create one accepts nothing but the two pdfmake files. GitHub Pages can't send HTTP headers, so `frame-ancestors` and HSTS aren't available.
- **Images.** Images go only to the radiologist's provider, or to every seat's provider with their first opinion if the user ticks "Let every consultant see the images". Each image is redrawn through a canvas, so EXIF (including GPS), comments and PNG text chunks are dropped, and the original file name is discarded. The user must tick a checklist for each image before a meeting can start, and black-out boxes are burned into the pixels with no unredacted copy kept. Images are held in memory only, so reloading the page clears them.
- **Keys.** Keys are kept in memory for the tab unless the user ticks "Remember my keys". Then they're encrypted with AES-GCM under a key derived from a passphrase with PBKDF2-SHA256 (600,000 iterations), and only the encrypted copy is saved. The passphrase is never stored. Plain-text keys saved by earlier versions are removed on first load.

Settings kept in `localStorage`: `mdt.vault` (encrypted keys), `mdt.default` and `mdt.seats` (model choices, stored as `provider|model`), `mdt.models.<provider>` (models found by "Check") and `mdt.custom.<provider>` (models typed in by hand) and `mdt.ui.details` (whether the case and panel are shown beside a meeting). The single-provider settings `mdt.provider` and `mdt.model.<provider>` are still read for migration.

## Deploying

Every push to `main` runs the tests and, if they pass, deploys `dist/` to GitHub Pages using `.github/workflows/deploy.yml`. Pull requests run the tests without deploying.

This needs a one-off setting: in the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**. The custom domain `mdt.ablease.co.uk` is set on the same page. Its DNS is a CNAME record at GoDaddy pointing `mdt` to `ablease.github.io`, plus the `_github-pages-challenge-ablease` TXT record that verifies the domain with GitHub. `public/CNAME` records the domain in the repository.

Dependabot checks npm packages and GitHub Actions weekly. pdfmake is excluded on purpose: upgrading it changes the PDFs, so do it deliberately.
