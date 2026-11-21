# Revision MDT Simulator: user guide

The simulator runs a pretend MDT meeting on a hip or knee revision case. AI "consultants" each give an opinion, discuss each other's views, and an AI chair writes up the outcome. It's a research tool. Everything it produces is AI-generated and simulated, and none of it is clinical advice.

Open it at **https://mdt.ablease.co.uk** and bookmark that address. Always use the bookmark, so you know you're on the real site.

## Only use fictional or fully anonymised cases

The case text is sent to the AI company you choose (OpenAI or Anthropic). Before you run a real case, remove anything that could identify the patient:

- names, initials, NHS numbers and hospital numbers
- dates of birth, and exact dates of operations or admissions (say "9 years ago" instead)
- addresses, postcodes, GP or hospital names
- unusual details that could identify someone, such as a rare job or a well-known event

If in doubt, leave it out or make it vaguer. Your trust's information governance team has the final say on what you can use.

## Getting an API key

The simulator uses your own account with an AI company, so the cost goes to you rather than anyone else. These accounts are separate from a ChatGPT or Claude subscription, even if you already pay for one of those.

You need at least one key. Having both lets you put different companies' models round the same table.

**OpenAI**

1. Go to platform.openai.com and sign up or sign in.
2. Open **Billing** and add some credit. New accounts can't make calls without it.
3. Open **API keys**, create a new key, and name it "MDT simulator".
4. Copy the key straight away. It starts with `sk-`, and OpenAI only shows it once.

**Anthropic**

1. Go to console.anthropic.com and sign up or sign in.
2. Open **Billing** and add some credit.
3. Open **API keys**, create a key, and name it "MDT simulator".
4. Copy it straight away. It starts with `sk-ant-`.

Paste the key into the matching box in the simulator and press **Check**. If it works, you'll see how many models your account can use, and the model menus fill up with them.

## Set a spending limit

Do this before your first meeting. Both companies let you set a monthly limit in their settings, usually under **Limits** or **Billing**. Once you reach it, calls stop until the next month or until you raise it. That way a mistake, or a key that falls into the wrong hands, can only cost so much.

A meeting makes between 9 and 16 calls, depending on how many consultants and rounds you choose. The simulator shows the exact number before you start. Your provider's usage page shows what each meeting actually cost.

## Keeping your keys safe

Treat an API key like a card number: anyone who has it can spend your credit.

- Use a separate key just for the simulator. If anything goes wrong, you can delete that one key without affecting anything else.
- The safest place to keep keys is a password manager. You can then paste them in each time you open the simulator, and they're never stored in the browser.
- If you'd rather not paste them every time, tick **Remember my keys** and choose a passphrase. The keys are saved on this computer, scrambled so they can't be read without the passphrase. You'll type the passphrase once each time you open the simulator. Three or four unrelated words make a good passphrase, for example "teapot glacier violin seven".
- If you forget the passphrase, there's no way to recover it. Press **Forget keys** and paste your keys in again.
- If you think a key has been seen by someone else, delete it on the OpenAI or Anthropic website and create a new one.
- Don't use **Remember my keys** on a shared or hospital computer.

The simulator moved to mdt.ablease.co.uk in November 2026. Keys saved at the old address don't come across, so paste them in again. It's a good moment to create new keys and delete the old ones.

## Running a meeting

1. Choose a test case, or **Blank case** to write your own. You can edit any case. Try changing one detail, such as the aspirate result, and run it again to see whether the panel changes its mind.
2. Under **Who sits at the table**, tick the consultants you want. You need at least two. The chair always attends. Each seat can use the default model or one of its own.
3. Choose one or two rounds of discussion.
4. Press **Hold the meeting**. Answers appear as they're written. A full meeting takes a minute or two.
5. Press **Stop** at any point to end the meeting early.
6. When it's finished, download a **PDF** report or the **JSON** file. The JSON file holds every prompt and answer, which is useful for research analysis.

Each card has a **Show the exact prompt sent** link, so you can see exactly what that consultant was asked.

## When something goes wrong

The simulator explains problems in plain words. The common ones:

- **"rejected the API key"**: the key is wrong or incomplete. Copy it again and paste the whole thing into the right box.
- **"rate limit or credit limit reached"**: you've run out of credit or hit your spending limit, or the account is new and has low limits. Add credit, wait a minute, or use fewer consultants on that company.
- **"Couldn't reach OpenAI"** (or Anthropic): check your internet connection. Some hospital networks block AI services, so try from home if it keeps happening.
- **"doesn't recognise that model name"**: press **Check** next to the key and pick a model from the list.

## Coming later

Attaching anonymised images to a case, and saving and backing up past meetings, are on the way. This guide will explain how to anonymise images and how to back up your meetings once those features arrive.
