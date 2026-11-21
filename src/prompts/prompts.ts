// Prompt wording has been tested with the clinical user. Change it only with agreement.
import type { Role } from "./roles";

export const FRAME = "This is a case used to test a research prototype that simulates a UK NHS multidisciplinary team (MDT) meeting for complex and revision hip and knee arthroplasty. Answer as you would in a real MDT, using current UK practice and widely accepted criteria where relevant.";
export const firstPrompt = (role: Role, text: string, imagesNote = "") =>
`${FRAME}

You are ${role.brief}

CASE:
${text}

${imagesNote ? imagesNote + "\n\n" : ""}Give your first opinion independently. Use exactly these short headings, each on its own line starting with "## ":
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

// Images (Feature 1). Wording agreed 21 November 2026. Without images none of this is used and
// the prompts above are unchanged.
const these = (n: number, one: string, many: string) => (n === 1 ? one : many);

// Sent as a text part just before each image.
export const imageLabel = (i: number, caption: string) =>
  caption.trim() ? `Image ${i + 1}: ${caption.trim()}` : `Image ${i + 1} (no caption)`;

export const imagingPrompt = (role: Role, text: string, n: number) =>
`${FRAME}

You are ${role.brief}

CASE:
${text}

${these(n, "The anonymised image above is labelled Image 1, with its caption if one was given.", `The anonymised images above are labelled Image 1 to Image ${n}, each with its caption if one was given.`)}

Before the meeting, write a structured report on ${these(n, "this image", "these images")} for the MDT. Describe only what you can see. Where something can't be judged from ${these(n, "this image", "these images")}, say so plainly rather than guessing. Don't give measurements, angles or classifications unless you can make them from the ${these(n, "image", "images")} yourself, and say how reliable they are. If the case summary describes imaging, say whether ${these(n, "this image agrees", "these images agree")} with it.

Use exactly these headings, each on its own line starting with "## ":
## Images reviewed
## Findings
## Limitations (image quality, missing views, what can't be judged from these images)
## Confidence (low / moderate / high, with one line why)
## Relevance to the MDT question

Under 300 words.`;

// Added to the case text the other seats (and the chair) see, framed as a colleague's report.
export const withImagingReport = (text: string, report: string, n: number) =>
`${text}

IMAGING REPORT (written by the radiologist from ${n} attached anonymised ${these(n, "image", "images")} before the meeting):
${report.trim()}`;

// Used in first opinions when "Let every consultant see the images" is ticked.
export const seeImagesNote = (n: number) => these(n,
  "The same image is attached above, labelled Image 1. You may look at it yourself, but describe only what you can see.",
  `The same images are attached above, labelled Image 1 to Image ${n}. You may look at them yourself, but describe only what you can see.`);
