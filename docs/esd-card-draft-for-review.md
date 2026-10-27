# Draft for review: Employment Security (ESD) card

**Status: DRAFT. Not applied. Not published. The rule stays Pending verification.**
Nothing in the app, the rules file or any database was changed. A named reviewer must compare this with the official page, then paste it into Admin as a draft and publish it with their own name.

## Why a change is proposed
- The card is titled "Register for employer taxes", but its current link goes to ESD's employers' guide to paying taxes.
- The rule's own record says: "The ESD pages read do not state the account registration step itself."
- ESD has a page that does describe registration. It was read on 2026-10-27 by Claude (not a named reviewer). It is the page whose address ends `/employer-taxes/register-your-business` (its on-page title is "How to file your quarterly tax and wage reports").

## What that page says (summarised, not quoted)
- Any employer with employees in Washington must register.
- The steps listed are: get a business license from the Department of Revenue (or update the license application if hiring for the first time), set up an Employer Account Management System (EAMS) account, then add the employer in EAMS.
- ESD states a fine for operating without registration. The amount is not repeated in the draft because it has not been checked by a reviewer.

## Draft values for Admin (fields Admin can edit)
| Admin field | Current | Proposed draft |
|---|---|---|
| Requirement name | Register for employer taxes with Employment Security | Register as an employer with Employment Security (ESD) |
| Plain-language detail | ESD says employers file quarterly tax and wage reports and pay unemployment taxes. Some employers, such as reimbursable employers, pay differently. Confirm your account setup and duties with ESD. Rates are not shown in this demo. | ESD says any employer with employees in Washington must register. The steps ESD lists are: get or update your business license with the Department of Revenue, set up an Employer Account Management System (EAMS) account, then add your employer in EAMS. After that you file quarterly tax and wage reports and pay unemployment taxes. Some employers, such as reimbursable employers, pay differently. ESD states a fine applies if you operate without registering. Confirm your account setup and duties with ESD. Rates are not shown in this demo. |
| Source name | ESD, Quarterly reports | ESD, Register your business for employer taxes |
| Source link (https) | https://esd.wa.gov/employer-requirements/quarterly-reports | https://www.esd.wa.gov/employer-taxes/register-your-business |
| Apply button text | See ESD's guide to employer taxes | Go to ESD's employer registration steps |
| Apply link (https) | https://esd.wa.gov/employer-requirements/unemployment-taxes/employers-guide-paying-taxes | https://www.esd.wa.gov/employer-taxes/register-your-business |
| Verification status | pending | **pending** (leave it pending until the reviewer has finished the checks below) |
| Verification note | ESD pages read on 2026-10-26 ... no reviewer has confirmed them yet. | ESD page "register your business" read on 2026-10-27: states who must register and three steps (DOR license, EAMS account, add employer). No reviewer has confirmed it yet. |

## Not editable in Admin (needs a change to `server/seed/rules.json` by a developer, after review)
- `limits`: "The ESD pages read do not state the account registration step itself." No longer true once the new page is used.
- `guide.conditions`: the line "Pending verification. The ESD pages reviewed did not state the account registration step, so this demo does not describe it." should be replaced.
- `guide.steps`: add the three registration steps in the order above, with the EAMS step marked external (done in ESD's own system).
- `guide.pendingNote` and `fallback` wording should match the new source.
- Changing these in the seed file affects a database that already loaded the old seed only if nobody has published an admin change. Check before deploying.

## Reviewer checklist (the reviewer fills in; I have not)
- [ ] Opened the page and confirmed it is ESD's official site (esd.wa.gov).
- [ ] Confirmed the three registration steps and the "any employer with employees" wording against the page.
- [ ] Confirmed the DOR business license is still the first step for a new employer.
- [ ] Decided whether to keep the employers' guide as a second source.
- [ ] Contacted ESD if anything is unclear (contact page: https://esd.wa.gov/about-us/contact-us).
- [ ] Saved the draft, entered their own name, published, then set status to checked only if every box above is done.

Reviewer name: [NEEDS HUMAN INPUT: reviewer]   Date: [NEEDS HUMAN INPUT]
Content owner: [NEEDS HUMAN INPUT: content owner]
