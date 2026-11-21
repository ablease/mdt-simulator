# Revision MDT Simulator: next development phase

You're helping me develop the **Revision MDT Simulator** further. It's a research prototype that simulates a UK NHS multidisciplinary team (MDT) meeting for complex and revision hip and knee arthroplasty. Several AI "consultants" each give an opinion on a case, discuss each other's views over one or two rounds, and then an AI chair records the outcome. A friend of mine, an orthopaedic doctor, uses it for a research project. He isn't technical, so everything he touches must be simple and clearly worded.

Read this whole brief, then look at the existing code before you change anything.

## Where things stand

- **Repo:** `ablease/mdt-simulator`, served by GitHub Pages at https://ablease.github.io/mdt-simulator/.
- **Code:** a single self-contained `index.html` (inline CSS and JS). There's no build step and no server.
- **API access:** the browser calls the providers directly, using the user's own API keys:
  - OpenAI: `POST https://api.openai.com/v1/chat/completions`, streaming over SSE.
  - Anthropic: `POST https://api.anthropic.com/v1/messages`, streaming, with the headers `anthropic-version: 2023-06-01` and `anthropic-dangerous-direct-browser-access: true`.
- **Keys:** each provider has its own key box with a "Check" button, which calls that provider's `/v1/models` to fill the model menus. Keys are kept in `localStorage` only if the user ticks "Remember my keys".
- **Seats:** the surgeon, microbiologist, radiologist, peri-op physician/anaesthetist and an optional devil's advocate. The chair always attends. Each seat can use the default model or its own provider and model.
- **Meeting flow:** first opinions (independent, run in parallel), then 1–2 discussion rounds (each seat sees the others' latest views), then the chair's decision. Responses stream into colour-coded cards, and each card can show the exact prompt it was sent. Prompts ask for fixed `## ` headings, which a small markdown-lite renderer formats.
- **Cases:** four built-in fictional test cases plus a blank anonymised template. The case text is editable.
- **Exports:** after a meeting the user can download JSON (the full record: seats, models, every prompt and response, timestamps) or a formatted A4 PDF built with pdfmake 0.2.7, loaded from cdnjs on demand. The PDF runs: panel, outcome, case summary, the rounds, then an appendix of the role instructions.
- **Retries:** 429 and 5xx errors retry with backoff. A 401 or 403 stops the meeting with a plain-English message.
- **Settings kept in `localStorage`:**
  - keys: `mdt.key.<provider>`
  - choices: `mdt.default`, `mdt.seats`, `mdt.remember`
  - model lists: `mdt.models.<provider>`, `mdt.custom.<provider>`

  Keep existing users' saved settings working, or migrate them.

The meeting logic and prompt wording have been tested and my friend likes the output, so keep the behaviour of the prompts unless I agree a change.

## Non-negotiables

1. **Privacy first.** The current design never sends case data anywhere except the AI provider the user chose. Keep that as the default. Don't add analytics, third-party trackers, or any server that receives case content without asking me first.
2. **Research tool, not a clinical device.** Every screen, export and report must say the output is simulated, AI-generated, and not clinical advice. The AI image interpretation especially must be labelled as unvalidated.
3. **Plain English in the UI.** Error messages say what went wrong and what to do next. Avoid jargon like "API error 400" on its own.
4. **Ask me before major decisions:** adding a backend, changing hosting, adding a paid service, or changing the prompts' meaning.

## Step 0: set up the project (do this first, then check in with me)

Move the single file into a small, maintainable project that still builds to **static files deployable to GitHub Pages**:

- Vite + TypeScript. Propose React or plain TypeScript based on how much UI state the features below need. I lean towards React for the desktop layout and meeting history, but tell me if you disagree.
- Split it into modules: providers, prompts, meeting engine, storage, export (PDF/JSON/CSV), UI.
- Put the meeting engine behind a provider-agnostic interface, so adding a provider or image support doesn't touch the UI.
- Add a GitHub Actions workflow that builds and deploys to Pages.
- Add Playwright tests that mock the OpenAI and Anthropic endpoints (streaming SSE responses), so a full meeting runs end to end without real keys. Cover:
  - a full meeting with mixed providers
  - stopping a meeting midway
  - a bad key (401)
  - a rate limit (429) followed by a retry
  - PDF and JSON export
- Carry the current behaviour over first. Show me it matches the live site before you build new features.

## Feature 1: anonymised images for the case

**Goal:** the user can attach X-rays, CT/MRI key slices or clinical photos to a case. An imaging seat interprets them and feeds its view into the MDT.

**Uploading**
- Drag and drop, or a file picker. Accept **PNG and JPEG only** in this phase. DICOM is out of scope for now because DICOM headers usually contain patient identifiers; list it as a possible later phase, with de-identification.
- Show thumbnails. Each image gets an optional caption, for example "AP pelvis, 3 months ago" or "CT axial, acetabulum".

**De-identification safeguards, built into the upload flow**
- Re-encode every image through a canvas, which strips EXIF and other metadata.
- Before an image can be used, show a clear checklist the user must tick: "I have checked this image for names, hospital numbers, dates of birth and other identifiers, including text burned into the image."
- Provide a simple **redaction tool**: draw black boxes over areas of the image, then apply them permanently before saving. Burned-in patient details on radiographs are common, so this matters.
- Downscale large images to a sensible maximum (around 1,500px on the long edge) to control cost and stay within provider limits.

**How images are used in the meeting**
- Add an **imaging seat**. Upgrade the existing musculoskeletal radiologist role rather than adding a separate one, unless you think separating them is cleaner; explain your choice.
- When images are attached, the imaging seat runs first, before the first opinions. It produces a structured imaging report with these headings:
  - Images reviewed
  - Findings
  - Limitations (image quality, missing views, what can't be judged from these images)
  - Confidence
  - Relevance to the MDT question
- Its prompt must tell it to describe only what is visible, to state uncertainty plainly, and not to invent measurements it cannot make.
- The other seats receive the **text of that imaging report**, not the images, to keep cost down. Add an option, "Let every consultant see the images", which is off by default.
- Show the imaging report as its own card and include it in the transcript and exports. Label it clearly: "AI image interpretation. Unvalidated, for research only."

**Provider details**
- OpenAI chat completions takes images as content parts: `{ "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }`.
- Anthropic messages takes `{ "type": "image", "source": { "type": "base64", "media_type": "image/jpeg", "data": "..." } }`, placed before the text part.
- Check the current API docs for both rather than relying on these notes.
- Not every model accepts images. If the imaging seat's chosen model rejects them, show a clear message suggesting a model that does, and don't fail the whole meeting.

## Feature 2: storing meetings and turning them into reports

**Storage**
- Default: keep everything in the browser with **IndexedDB**. That means case text, image blobs, the panel configuration, models, every prompt and response, and timestamps. No server needed.
- Make it clear in the UI that meetings are stored on this computer only. Clearing browser data deletes them, so back up regularly.
- **Backup and restore:** export all meetings, or selected ones, as a single file (JSON with images embedded, or a zip), and import it again. That's how he'd move between computers or share with a supervisor.
- Present an optional cloud option to me as a separate proposal; don't build it yet. I know Azure, so the obvious candidate is Static Web Apps with Functions, Cosmos DB, Blob Storage, and Entra ID sign-in. Outline the information governance implications of storing case data in the cloud.

**Meeting history**
- A history view listing past meetings: date, case title, panel or models, outcome summary (the first line of the chair's decision), and the level of agreement.
- Search and filter by case, model, provider and date.
- Open a past meeting read-only. Add a "Rerun this case" action that loads the same case, images and panel.
- Delete a meeting, with an in-page confirmation step. Don't use `confirm()`.

**Research fields** (these matter for his study)
- For each meeting, optional fields:
  - **Actual MDT decision**, so the real outcome can be compared with the simulated one
  - **Reviewer rating** of the simulated decision, such as agree / partly agree / disagree
  - **Free-text notes**
- Tag meetings with a case ID he chooses, so repeat runs of the same case group together. He'll want to run each case several times to check consistency.

**Reports**
- **Single-meeting PDF:** keep the current PDF and add the imaging report, the thumbnails with their captions, and the research fields when they're filled in.
- **Word (.docx) export** of a single meeting, so he can edit it. Use a well-established library, for example `docx`.
- **Comparison report** across selected meetings, for example the same case run five times, or with different panels. Include a summary table with one row per run: date, panel models, decision, level of agreement, actual decision, reviewer rating. Then show each run's chair decision side by side or in sequence.
- **CSV export** of the same summary table, for analysis in Excel, SPSS or R.

## Feature 3: desktop-first UI cleanup

His main use is on a laptop or desktop. Optimise for widths of 1280px and up, and keep it usable (not perfect) on a tablet.

- **Layout:** a three-area workspace.
  - Left sidebar: navigation (New meeting, History, Settings) and the meeting history list.
  - Centre: the meeting itself, a timeline of rounds with cards.
  - Right panel, collapsible: the case and images, plus the panel and model configuration for the current meeting.
- **Settings page:** API keys, default model, the "Model not in the list?" option, storage and backup. Move these out of the main flow.
- **"New meeting" as a short guided flow:** 1) case text, 2) images (optional), 3) panel and models, 4) review and run. Show the number of AI calls and the providers used before running.
- **During a meeting:**
  - Cards for the current round in a grid.
  - Earlier rounds collapsible.
  - A progress indicator.
  - Stop and retry for failed cards. Retrying a single failed seat shouldn't mean rerunning the meeting.
- **Visual direction:** calm and clinical, with plenty of whitespace and clear hierarchy.
  - Keep the per-specialty colour coding, which he likes.
  - Light and dark themes.
  - Visible focus states and full keyboard operability.
  - Respect `prefers-reduced-motion`.
- Keep the fictional/anonymised-only warning visible but less dominant, for example a persistent slim bar plus the checklist at image upload.

## How I'd like you to work

- Work in the order above: Step 0, then Feature 1, Feature 2, Feature 3. Small commits with clear messages.
- At the start of each feature, give me a short plan: the data model, the main components, anything you're unsure about. Wait for my OK on anything that touches privacy, storage location or prompt wording.
- After each feature, run the test suite and add tests for the new behaviour. Use mocked image responses for Feature 1.
- Keep a `README.md` up to date with how to run locally, test, and deploy. Write a separate `USER-GUIDE.md` in plain English for my friend: getting an API key, setting a spending limit, anonymising images, backing up meetings.
- Never commit API keys or real case data. Add sensible `.gitignore` entries.

Start with Step 0: look at the current `index.html`, then propose the project structure and framework choice before writing code.
