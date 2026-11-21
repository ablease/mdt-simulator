// Prompt wording has been tested with the clinical user. Change it only with agreement.
import type { Role } from "./roles";

export const FRAME = "This is a case used to test a research prototype that simulates a UK NHS multidisciplinary team (MDT) meeting for complex and revision hip and knee arthroplasty. Answer as you would in a real MDT, using current UK practice and widely accepted criteria where relevant.";
export const firstPrompt = (role: Role, text: string) =>
`${FRAME}

You are ${role.brief}

CASE:
${text}

Give your first opinion independently. Use exactly these short headings, each on its own line starting with "## ":
## Key concerns
## What I'd want to know
## My recommendation
## Confidence (low / moderate / high, with one line why)

Be specific and concise: under 200 words in total. Bullet points are fine.`;
export const discussPrompt = (role: Role, text: string, others: string, roundNo: number) =>
`${FRAME}

You are ${role.brief}

CASE:
${text}

Discussion round ${roundNo}. These are your colleagues' latest views:

${others}

Respond to your colleagues. Use exactly these headings, each on its own line starting with "## ":
## Where I agree
## Where I disagree
## My position now (say clearly whether it has changed and why)

Engage with specific points colleagues made by naming their specialty. Under 170 words.`;
export const chairPrompt = (text: string, transcript: string) =>
`${FRAME}

You are the chair of the MDT. You have heard the full discussion below. Your job is to record the MDT outcome as it would appear in the MDT minutes, faithfully reflecting the discussion rather than adding a new opinion of your own.

CASE:
${text}

DISCUSSION:
${transcript}

Write the outcome using exactly these headings, each on its own line starting with "## ":
## MDT decision
## Rationale
## Before surgery (investigations or optimisation still needed)
## Dissent recorded
## Level of agreement (unanimous / majority / no consensus, and who differed)

Under 280 words.`;
