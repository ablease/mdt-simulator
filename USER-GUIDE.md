# Revision MDT Simulator: user guide

The simulator runs a pretend MDT meeting on a hip or knee revision case. AI "consultants" each give an opinion, discuss each other's views, and an AI chair writes up the outcome. It's a research tool. Everything it produces is AI-generated and simulated, and none of it is clinical advice.

Open it at <https://mdt.ablease.co.uk> and bookmark that address. Always use the bookmark, so you know you're on the real site.

## Only use fictional or fully anonymised cases

The case text is sent to the AI company you choose (OpenAI or Anthropic). Before you run a real case, remove anything that could identify the patient:

- names, initials, NHS numbers and hospital numbers
- dates of birth, and exact dates of operations or admissions (say "9 years ago" instead)
- addresses, postcodes, GP or hospital names
- unusual details that could identify someone, such as a rare job or a well-known event

If in doubt, leave it out or make it vaguer. Your trust's information governance team has the final say on what you can use.

The yellow bar across the top of every page is there as a reminder of this.

## Getting an API key

The simulator uses your own account with an AI company, so the cost goes to you rather than anyone else. These accounts are separate from a ChatGPT or Claude subscription, even if you already pay for one of those.

You need at least one key. Having both lets you put different companies' models round the same table.

### OpenAI

1. Go to platform.openai.com and sign up or sign in.
2. Open **Billing** and add some credit. New accounts can't make calls without it.
3. Open **API keys**, create a new key, and name it "MDT simulator".
4. Copy the key straight away. It starts with `sk-`, and OpenAI only shows it once.

### Anthropic

1. Go to console.anthropic.com and sign up or sign in.
2. Open **Billing** and add some credit.
3. Open **API keys**, create a key, and name it "MDT simulator".
4. Copy it straight away. It starts with `sk-ant-`.

In the simulator, open **Settings** from the list on the left. Paste the key into the matching box and press **Check**. If it works, you'll see how many models your account can use, and the model menus fill up with them.

## Set a spending limit

Do this before your first meeting. Both companies let you set a monthly limit in their settings, usually under **Limits** or **Billing**. Once you reach it, calls stop until the next month or until you raise it. That way a mistake, or a key that falls into the wrong hands, can only cost so much.

A meeting with the usual four consultants and one round of discussion makes 9 calls. The most a meeting can make is 17: five consultants, two rounds and an imaging review. The simulator shows the exact number before you start. Your provider's usage page shows what each meeting actually cost.

## Keeping your keys safe

Treat an API key like a card number: anyone who has it can spend your credit.

- Use a separate key just for the simulator. If anything goes wrong, you can delete that one key without affecting anything else.
- The safest place to keep keys is a password manager. You can then paste them in each time you open the simulator, and they're never stored in the browser.
- If you'd rather not paste them every time, tick **Remember my keys** in Settings and choose a passphrase. The keys are saved on this computer, scrambled so they can't be read without the passphrase. You'll type the passphrase once each time you open the simulator, either in Settings or on the last step before a meeting. Three or four unrelated words make a good passphrase, for example "teapot glacier violin seven".
- If you forget the passphrase, there's no way to recover it. Press **Forget keys** and paste your keys in again.
- If you think a key has been seen by someone else, delete it on the OpenAI or Anthropic website and create a new one.
- Don't use **Remember my keys** on a shared or hospital computer.

The simulator moved to mdt.ablease.co.uk in November 2026. Keys saved at the old address don't come across, so paste them in again. It's a good moment to create new keys and delete the old ones.

## Running a meeting

The list on the left has three links: **New meeting**, **History** and **Settings**. Add your key under Settings first. Then press **New meeting**, which takes you through four steps. Move between them with **Next** and **Back**, or by clicking a step's name. Nothing you've typed is lost when you move between steps.

1. **Case.** Choose a test case, or **Blank case** to write your own. You can edit any case. Try changing one detail, such as the aspirate result, and run it again to see whether the panel changes its mind. If you like, give the case a **Case ID** of your own, such as "PJI-01". Every run with the same Case ID is grouped together in History, which helps when you run a case several times to check consistency. The Case ID isn't sent to the AI, but don't use a hospital number or anything else that could identify a patient.
2. **Images.** This step is optional. See the next section before you add any.
3. **Panel and models.** Tick the consultants you want. You need at least two, and the chair always attends. Each seat can use the default model or one of its own. Then choose one or two rounds of discussion.
4. **Review and run.** Check the case, the images, and who sits at the table on which model. The simulator shows how many AI calls the meeting will make and which companies they go to. If something needs sorting out first, it says what and gives you a link to the right step. Press **Hold the meeting** when you're ready.

The meeting page opens straight away. Answers appear as they're written, and a full meeting takes a minute or two. The line at the top shows which round you're in and how many answers are in so far, and it stays there with the **Stop** button as you scroll. Press **Stop** at any point to end the meeting early. The case and panel the meeting was run with are shown down the right-hand side. Press **Hide case and panel** if you want more room for the answers.

As each round starts, the one before it folds up into a line of names, so the round in progress is the one you see. Click a round's name to open it again, or **Show every round** to open them all.

### If a consultant doesn't answer

Sometimes a call fails, for example because a key was rejected, the company was busy or your connection dropped. That card then says what went wrong, and once everyone else in the round has finished, the meeting waits for you. You can:

- press **Try again** to ask the same question again, either on one card or for everyone who didn't answer;
- press **Carry on without them** to move on. The rest of the meeting goes ahead without that answer.

The next round doesn't start until you choose, so whatever you decide, everyone after that point reads the same discussion. If a key was the problem, go to **Settings**, correct it, then come back to the meeting from **Recent meetings** on the left and press **Try again**. The tab's title says "Waiting for you" while the meeting waits, in case you're looking at something else.

Trying again sends exactly the same question. It won't help if the model itself is wrong for the seat, for example one that can't read images. In that case, carry on, then choose another model before you run the case again.

The meeting isn't saved until it finishes or you stop it, so don't close the tab while it's waiting.

When it finishes, or when you stop it, the meeting is saved on this computer automatically. You can then download it as a **PDF** report, a **Word** document you can edit, or a **JSON** file. The JSON file holds every prompt and answer, which is useful for research analysis. If you attached images, all three include them.

Each card has a **Show the exact prompt sent** link, so you can see exactly what that consultant was asked.

You can start setting up the next meeting while one is still running. The running meeting carries on, and you can get back to it from **Recent meetings** on the left.

## Your saved meetings

Every meeting is saved when it finishes, as long as at least one consultant answered. Your most recent meetings are listed on the left, and **History** lists them all. Open one to read it again. A saved meeting can't be changed, but you can add your own research notes to it.

### Research notes

At the bottom of each saved meeting there's a **Research notes** section:

- **Case ID**: the label that groups repeat runs of a case.
- **Actual MDT decision**: what the real MDT decided, so you can compare it with the simulated one.
- **Do you agree with the simulated decision?**: agree, partly agree or disagree.
- **Notes**: anything else.

Your notes are saved as you type. They're included in that meeting's PDF, Word and JSON files. The AI never sees them.

### Running a case again

Press **Rerun this case** on a saved meeting. The simulator sets up a new meeting with the same case, images, consultants, models and number of rounds, and takes you to the review step. You'll need to tick each image again to confirm it's been checked.

### Comparing runs

In **History** you can search, and narrow the list by case, model, AI company or date. Tick the meetings you want, then press one of these:

- **Comparison report (PDF)**: a table with one row per meeting (date, panel, decision, level of agreement, your actual decision and rating), followed by each chair's decision in turn.
- **Spreadsheet (CSV)**: the same table, for Excel, SPSS or R.
- **Back up these**: a backup of just those meetings, for example to send to a supervisor.
- **Delete these**: removes them from this computer. You'll be asked to confirm first.

To delete a single meeting, open it and press **Delete this meeting**.

## Backing up your meetings

Your meetings are kept in this web browser, on this computer, and nowhere else. That has two consequences:

- They don't appear on any other computer, or in a different browser on this one.
- If you clear your browser's history and site data, or the computer is replaced, they're gone.

So back up regularly, say once a week, and always before clearing your browser or changing computers. Your browser may also tidy up stored data if the computer runs very short of space. The simulator asks it not to, and **Settings** shows whether it agreed.

To make a backup, go to **History** or **Settings** and press **Back up all meetings**. A file named something like `mdt-backup-2026-11-21.json` is downloaded, holding every meeting with its images and notes. Keep it somewhere your trust allows for research data, and treat it as carefully as the cases in it. The sidebar and History show when you last made a full backup.

To get your meetings back, or to move them to another computer, open the simulator there and press **Restore from a backup**. Choose the backup file. Meetings that are already there aren't duplicated. If both copies have notes, the one edited most recently is kept.

**Restore from a backup** also accepts the JSON file of a single meeting. That includes JSON files you downloaded before meetings were saved, so those runs can join your history.

**Delete all saved meetings** in Settings removes every meeting from this computer. Make a backup first if you might need them.

## Adding images

You can attach X-rays, CT or MRI key slices, or clinical photos, up to 10 per case. Before the meeting, the radiologist looks at them and writes an imaging report. The other consultants read that report as part of the case.

The report is labelled "AI image interpretation. Unvalidated, for research only." Both OpenAI and Anthropic say their models aren't designed to interpret specialised medical images such as CT or MRI scans. Bear that in mind when reading the report. How well it does is part of what your research can test.

### Getting an image ready

Use PNG or JPEG files. A screenshot or export from your image viewer works well. DICOM files can't be used yet, because they usually carry patient details inside the file. iPhone photos saved as HEIC need exporting as JPEG first.

### Removing identifiers

When you add an image, the simulator shrinks it and redraws it. That removes details hidden inside the file, such as when and where it was taken, and the file name is thrown away. What it can't do is notice text that's part of the picture. X-rays often have the patient's name, hospital number and date of birth printed in a corner. So for every image:

1. Look over the whole image, especially the corners and edges.
2. Press **Black out areas** and drag a box over anything that could identify the patient. Add as many boxes as you need. Without a mouse, press **Add box**, move it with the arrow keys, and hold Shift with the arrow keys to resize it.
3. Press **Save**. The boxes are burned into the image and can't be taken off again. If you make a mistake, remove the image and add it again.
4. Tick the box under the image to confirm you've checked it. The meeting won't start until every image is ticked, and changing an image clears its tick.

Captions are sent with the images, so keep them anonymous too. Write "AP pelvis, 3 months ago" rather than a date.

### Who sees the images

Only the radiologist sees the images, unless you tick **Let every consultant see the images**. Then each consultant also gets them with their first opinion. That costs more, because every first-opinion call then includes the images.

While images are attached, the radiologist always attends, and their seat needs a model that can read images. All Claude models can, and so can gpt-5. If the model can't, the radiologist's card says so and suggests another. The meeting then waits for you to carry on without an imaging report, or to stop.

Images are saved with the meeting once it has run. If you reload the page before running the meeting, you'll need to add them again.

## Light and dark

The simulator follows your computer's light or dark setting. To choose one yourself, go to **Settings** and pick **Light** or **Dark** under **Appearance**. PDFs and Word files always use the light colours.

## Using the keyboard

Everything works without a mouse. **Tab** moves between controls, and **Enter** or **Space** presses them. **Escape** closes the black-out editor and cancels a delete. When the simulator first opens, the first press of **Tab** reaches **Skip to main content**, which jumps past the links on the left.

## When something goes wrong

The simulator explains problems in plain words. The common ones:

- **"rejected the API key"**: the key is wrong or incomplete. The meeting waits. Copy the key again, paste the whole thing into the right box in Settings, then go back to the meeting and press **Try again**.
- **"rate limit or credit limit reached"**: you've run out of credit or hit your spending limit, or the account is new and has low limits. Add credit, wait a minute, or use fewer consultants on that company.
- **"Couldn't reach OpenAI"** (or Anthropic): check your internet connection, then press **Try again**. Some hospital networks block AI services, so try from home if it keeps happening.
- **"doesn't recognise that model name"**: trying again won't help. Carry on without that seat, then press **Check** next to the key and pick a model from the list before the next meeting.
- **"couldn't read the images"**: the radiologist's model can't take images. Choose one that can for the radiologist, such as gpt-5 or claude-sonnet-5-5, and run the meeting again.
- **"This meeting wasn't saved, because no consultant answered"**: every call failed and the meeting was stopped, usually because of a key problem. Read the message on the cards, fix it, and run the meeting again.
- **"This browser isn't letting the simulator save anything"**: this usually means a private or incognito window. Open the simulator in a normal window, or download each meeting before you close the tab.
- **"This file isn't a backup or a meeting from the Revision MDT Simulator"**: the file you chose to restore wasn't made by the simulator. Look for a file whose name starts with `mdt-backup-` or `mdt-`.
