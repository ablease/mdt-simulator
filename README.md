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

The end-to-end tests run against the production build, so the security policy is in force. They replace `api.openai.com` and `api.anthropic.com` with mocks that stream answers in each provider's real event format, so no keys or credit are needed. They cover a full meeting across both providers, stopping midway, a rejected key, a rate limit followed by a retry, the PDF and JSON downloads, the key check, the passphrase lock and the migration of older saved settings. For images, they upload real JPEG and PNG files with a patient's name planted in the EXIF data, a JPEG comment and a PNG text chunk, and check that none of it, nor the file name, reaches the provider or the exports. They also check downscaling, EXIF rotation, black-out boxes burned into the pixels, the checklist, refused file types, and a model that can't read images. The layout tests check that every page shows the research-only notice, that the four set-up steps work from the keyboard, that the review step links to whatever needs fixing, that a meeting keeps running while you look at other pages, and that nothing overflows sideways at tablet and phone widths. The storage tests check that:

- meetings are saved and survive a reload;
- a meeting nobody answered isn't saved;
- research notes reach the JSON, PDF and Word files but never a provider;
- "Rerun this case" restores the case, images and panel;
- History's filters and its comparison and CSV exports work, including the escaping of formula-like cells;
- deleting asks on the page rather than in a pop-up;
- a backup restores in full, and restoring it twice adds nothing;
- an old single-meeting download can be restored;
- an image with planted EXIF data in a restored file is redrawn clean;
- a second open tab sees new meetings.

Every run also asserts that the page contacted nobody except itself and the two providers.

Until saved meetings changed the JSON on purpose, a parity test ran the same meetings through the original single-file app and this build and found the requests, transcript, JSON and PDF byte-identical. That test and the original app were retired in November 2026. Both are in the git history (`legacy/index.html`, `tests/e2e/parity.spec.ts`) if they're ever needed again.

## Prompts

The prompt wording has been tested with the clinical user, so it's frozen by snapshot tests in `tests/unit/prompts.test.ts`. If you change a prompt, a role brief or a built-in case, that test fails and shows the difference. The image prompts in `src/prompts/prompts.ts` were agreed on 21 November 2026 and are frozen the same way. Without images, none of them are used and every prompt is exactly as it was. Agree the change first, then update the snapshot with `npx vitest run -u`.

## How it's put together

| Folder | What's in it |
|---|---|
| `src/providers/` | One file per AI provider behind a common `Provider` interface: list models, stream an answer. Messages are passed as content parts so images can be added without touching the UI. |
| `src/prompts/` | The shared framing, the seats at the table, the three prompt templates and the imaging review prompt. |
| `src/images/` | Checks the file type from its first bytes, shrinks images to 1,568 px on the long edge, redraws them through a canvas as JPEG (which drops all metadata) and burns in black-out boxes. |
| `src/meeting/` | The meeting engine: an imaging review when images are attached, first opinions in parallel, discussion rounds, the chair, retries and stopping. It publishes a view of the meeting that React renders, and builds the record that's saved and downloaded. `summary.ts` pulls out the one-line facts History shows (the decision, the level of agreement), and `fromRecord.ts` rebuilds the cards from a saved record. |
| `src/storage/` | Saved settings in `localStorage`, the passphrase-locked key store, saved meetings in IndexedDB (`meetings.ts`), and backup files (`backup.ts`). |
| `src/export/` | JSON, PDF, Word, comparison report and CSV downloads. The PDFs use pdfmake 0.2.7 and Word files use docx 9.15.3, both served from this site. The docx library is loaded only when someone asks for a Word file. |
| `src/ui/` | React components. `App.tsx` lays out the slim notice bar, the sidebar, the page and, on the meeting page, the case and panel. `route.ts` maps the part of the address after `#` to a page, so GitHub Pages can serve every page from `index.html`. `useDraft.ts` holds the meeting being set up, `readiness.ts` decides whether it can run, and `pages/` has one component per page. |

## Security and privacy

Case text only ever goes to the AI provider the user picks. Beyond that:

- **Own address.** Browsers keep saved data separate per site address. The app lives on its own subdomain so that no other site on `ablease.github.io` or `ablease.co.uk` can read what it stores.
- **No third-party requests.** Fonts, pdfmake and docx are bundled with the site, so the page only contacts itself and the two providers.
- **Content Security Policy.** A `<meta>` tag added at build time (`vite.config.ts`) only lets the page load its own files and only connect to `api.openai.com` and `api.anthropic.com`. Trusted Types are required for script URLs, and the only policy allowed to create one accepts nothing but the two pdfmake files. GitHub Pages can't send HTTP headers, so `frame-ancestors` and HSTS aren't available.
- **Images.** Images go only to the radiologist's provider, or to every seat's provider with their first opinion if the user ticks "Let every consultant see the images". Each image is redrawn through a canvas, so EXIF (including GPS), comments and PNG text chunks are dropped, and the original file name is discarded. The user must tick a checklist for each image before a meeting can start, and black-out boxes are burned into the pixels with no unredacted copy kept. Images are saved with the meeting once it's run. "Rerun this case" brings them back unticked, so each one is confirmed again.
- **Keys.** Keys are kept in memory for the tab unless the user ticks "Remember my keys". Then they're encrypted with AES-GCM under a key derived from a passphrase with PBKDF2-SHA256 (600,000 iterations), and only the encrypted copy is saved. The passphrase is never stored. Plain-text keys saved by earlier versions are removed on first load.

- **Saved meetings.** Every meeting that got at least one answer is saved in IndexedDB in this browser, on this computer, when it finishes or is stopped. That covers the case, images, panel, every prompt and answer, and the research fields. It isn't encrypted, which was agreed: the cases are fictional or anonymised, the PDFs and JSON files people download aren't encrypted either, and a forgotten passphrase would lock someone out of their research. The browser is asked once (`navigator.storage.persist()`) not to clear the data when space runs low. The research fields (case ID, actual MDT decision, rating, notes) are never sent to a provider.
- **Backups and restore.** A backup is one JSON file with images embedded. A file being restored may have come from someone else, so `src/storage/backup.ts` checks every field's type and size and copies across only the fields it knows, which drops anything unexpected (including `__proto__`). A meeting that doesn't fit is skipped, and the rest are restored. Restored images must be JPEG. Any image carrying metadata (EXIF or other APPn blocks, comments, a JFIF thumbnail), or larger than 1,568 px, is redrawn through a canvas, as an upload would be. A restored copy only replaces a saved meeting if its notes were edited more recently.
- **CSV.** Cells starting with `=`, `+`, `-` or `@` get a leading apostrophe, so a spreadsheet shows AI-written text instead of running it as a formula.

Saved meetings are kept in IndexedDB, database `mdt-simulator`: store `meetings` holds a short summary of each for the history list, and store `records` holds the full meeting. Settings kept in `localStorage`: `mdt.vault` (encrypted keys), `mdt.default` and `mdt.seats` (model choices, stored as `provider|model`), `mdt.models.<provider>` (models found by "Check") and `mdt.custom.<provider>` (models typed in by hand) `mdt.ui.details` (whether the case and panel are shown beside a meeting) and `mdt.lastBackup` (when every meeting was last backed up). The single-provider settings `mdt.provider` and `mdt.model.<provider>` are still read for migration.

## Deploying

Every push to `main` runs the tests and, if they pass, deploys `dist/` to GitHub Pages using `.github/workflows/deploy.yml`. Pull requests run the tests without deploying.

This needs a one-off setting: in the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**. The custom domain `mdt.ablease.co.uk` is set on the same page. Its DNS is a CNAME record at GoDaddy pointing `mdt` to `ablease.github.io`, plus the `_github-pages-challenge-ablease` TXT record that verifies the domain with GitHub. `public/CNAME` records the domain in the repository.

Dependabot checks npm packages and GitHub Actions weekly. pdfmake is excluded on purpose: upgrading it changes the PDFs, so do it deliberately. New packages are pinned to an exact version at least two weeks old.

## Cloud storage

Meetings are only stored in the browser. A proposal for optional cloud storage on Azure, with its information governance implications, is in [docs/cloud-proposal.md](docs/cloud-proposal.md). Nothing in it has been built.
