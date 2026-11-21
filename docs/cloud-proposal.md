# Optional cloud storage: a proposal

**Status:** proposal only. Nothing here has been built. Written 21 November 2026 for Alex to decide on, as the brief asked.

## The problem it would solve

Saved meetings live in one browser on one computer. That's simple and keeps case data off any server, but it has costs for a study that will run each case several times:

- meetings run on a work PC and a home laptop end up in two separate histories;
- backups depend on someone remembering to press a button;
- a supervisor sees results only when sent a backup or report file;
- clearing browser data, or a replaced computer, loses anything not backed up.

Cloud storage would fix all four. It would also mean a server receiving case content for the first time. The brief rules that out without your agreement, and the information governance work it brings is bigger than the code.

## Three options

**A. Stay as now.** IndexedDB in the browser, with manual backups. No server, no new IG questions beyond the ones the AI providers already raise. The weakness is human: backups get forgotten.

**B. Backups to storage the trust already approves.** No new server. The simulator would keep working as it does, and the user would save backup files to somewhere their trust or university already approves for research data, such as an institutional OneDrive or SharePoint site. This could stay a written procedure in the user guide. A later step could add a "Save backup to OneDrive" button using Microsoft Graph, but that adds a sign-in and a new site the page talks to, so it would need your agreement too.

**C. An Azure back end.** Described below. It gives access from any computer, automatic saving, and supervisor access, at the cost of running a service that holds health data.

My recommendation is B now, and C only if the friend's trust or university asks for it and agrees to host it. More on why under "Who would run it".

## What option C would look like

```text
Browser (mdt.ablease.co.uk or a trust domain)
  ├── OpenAI / Anthropic        AI calls, direct from the browser with the user's own key (unchanged)
  └── /api/*  ──► Azure Functions (UK South) ──► Cosmos DB   meeting records and research notes
                     managed identity      └──► Blob Storage  images, private container
Sign-in: Microsoft Entra ID, limited to one organisation
```

- **Azure Static Web Apps, Standard plan.** It serves the same static site, and its `/api` route sends calls to a linked Functions app. Two features this design needs exist only on the Standard plan:
  - limiting sign-in to one organisation's Entra ID tenant, through custom authentication;
  - linking a separate Functions app ("bring your own functions").
- **Microsoft Entra ID sign-in, restricted to one tenant.** Every API route requires a signed-in user with a "researcher" role.
  - The built-in provider on its own accepts any Microsoft account, so it isn't enough.
  - There are recent reports of the custom provider misbehaving, so this needs testing before it's relied on.
  - A fallback is the built-in provider with access granted by role invitations.
- **Azure Functions in UK South.** A small API: list, get, save, delete, and update research notes. It would check incoming meetings with the same rules as `src/storage/backup.ts`.
  - It connects to the database and storage with a managed identity, so no passwords or connection strings sit in settings.
  - That's why it must be a separate Functions app: Static Web Apps' built-in functions can't use managed identities.
- **Cosmos DB, serverless, in UK South.** It holds one document per meeting, without images. Partitioning by owner or by study keeps each person's data apart.
  - Turn on continuous backup, so records can be restored to an earlier point in time.
- **Blob Storage in UK South.** A private container holds the images. The browser never gets direct access: images come through the API, or through short-lived links the API signs for one image at a time.
- **Logging.** Application Insights on the server only, set not to record request or response bodies, so case text and images never reach the logs. Nothing would be added to the page itself, in keeping with the "no analytics or trackers" rule.

**What stays the same:**
- The browser still calls OpenAI and Anthropic directly with the user's own key. The server never sees API keys or AI traffic.
- Saving to the cloud would be opt-in, per user or per meeting. IndexedDB stays the default.
- The security policy would add the API, which is on the same address, so `connect-src 'self'` already covers it.

A variation would move the AI calls behind the server too, so keys could sit in Azure Key Vault instead of the browser. That would make the server a processor of every prompt and answer, not just the stored ones. It's a larger change, with a larger IG footprint, so I've left it out.

**Rough running cost.** At this study's scale, expect something like £10 to £20 a month. Most of it is the Static Web Apps Standard plan; Cosmos DB serverless and Blob Storage would cost pennies for a few hundred meetings. Check current Azure pricing before deciding.

## Information governance implications

This is the deciding part. The friend's trust or university IG team and the research sponsor make these calls, not us. These are the questions they'll ask.

**Is it personal data?** Truly fictional cases are not. Real cases are harder:
- Free-text clinical summaries and radiographs are difficult to anonymise reliably. Age, sex, a rare complication and a rough timeline can be enough for someone who knows the patient to recognise them. This is the "motivated intruder" test in the ICO's guidance.
- Pseudonymised data is still personal data under UK GDPR.
- The safe working assumption is that stored real cases are health data, which is special category data, unless the IG team agrees they're anonymous.

**Who is the controller?**
- For research, the sponsoring trust or university is normally the data controller.
- Whoever runs the Azure subscription is a processor, and needs a written contract with the controller.
- An NHS IG team is unlikely to accept health data in a personal Azure subscription run by an individual outside the organisation. That's the main reason for the recommendation below.

**Lawful basis and confidentiality.**
- Research in the NHS or a university usually relies on UK GDPR Article 6(1)(e), public task, and Article 9(2)(j), research with safeguards.
- Separately, the common law duty of confidentiality needs patient consent or Section 251 support, unless the data is anonymised.
- Research using patient data also needs ethics and HRA approval.

**A DPIA is needed.** Health data, a new technology and AI processing together make it likely to be high risk. The DPIA should cover the cloud store and the AI providers together, because the AI providers process case text in the United States. That's true today without any cloud store, and the DPIA would need to cover it either way.

**NHS assurance.** Organisations handling NHS patient data are expected to meet the Data Security and Protection Toolkit (DSPT). A personal project can't. Hosting inside a trust's or university's tenant inherits its assurance.

**Controls the IG team will expect:**
- Sign-in with multi-factor authentication, limited to the organisation.
- Least-privilege roles, with an audit log of who opened or changed what.
- UK-only storage (UK South, with UK West for redundancy).
- Encryption in transit and at rest. Azure does this by default; customer-managed keys are optional.
- A retention period that matches the study protocol, and a deletion process.
- Tested backups, and an incident response plan.
- A penetration test before real data goes in.

**Sharing.** Supervisor access would be a role in the app, logged and removable. That's better than emailing backup files, which is how sharing works in options A and B.

## Who would run it

If option C goes ahead, it should live in the sponsoring trust's or university's Azure tenant, under their IG approvals, with Alex as a contributor rather than the operator. Many universities already provide approved research data platforms, so it's worth asking whether one of those would do before building anything.

## Questions to take to the IG team

1. Will the study use fictional cases only, anonymised real cases, or pseudonymised real cases?
2. Who is the sponsor and data controller?
3. Is there an approved place for research data already, such as OneDrive, SharePoint, REDCap or a trust Azure tenant?
4. Does the existing use of OpenAI and Anthropic already have a DPIA, and would cloud storage be added to it?
5. How long must the data be kept, and who else needs access?

## Sources

- Microsoft Learn: [Custom authentication in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) (Standard plan only; restricting to one tenant)
- Microsoft Learn: [Bring your own functions to Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/functions-bring-your-own) and [API support with Azure Functions](https://learn.microsoft.com/en-us/azure/static-web-apps/apis-functions) (managed identity needs a linked Functions app, Standard plan only)
- Microsoft Q&A: [Limiting which tenant can sign in to a Static Web App](https://learn.microsoft.com/en-us/answers/questions/1418104/how-can-you-limit-which-tenant-authentication-is-a) and a [July 2026 report of custom Entra ID sign-in failing](https://learn.microsoft.com/en-us/answers/questions/5962699/custom-entra-id-auth-on-static-web-apps-callback-r)
- ICO: guidance on anonymisation and pseudonymisation; HRA and NHS England: DSPT and Section 251 guidance. These are named for the IG team to consult. I haven't summarised their current wording here.
