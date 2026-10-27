# Rules needing human review

Built from `server/seed/rules.json` on 2026-10-27. Your running database may differ if someone has already published a change in Admin.

No reviewer or content owner has been assigned or invented here. Every reviewer cell is a placeholder for your team to fill in.

**How to read it.** "Source checked" means the official page was read on the date shown and compared with the rule. It is not an agency approval and it is not a named-reviewer sign-off. A rule is only fully reviewed when a named person has compared it with the official page and published it in Admin.

| # | Rule (id) | Agency | Source | Verification status | Last verified | Content owner | Reviewer | What the reviewer must confirm |
|---|---|---|---|---|---|---|---|---|
| 1 | Check for a county health department permit (`health`) | County health department | [DOR, Open a business](https://dor.wa.gov/open-business) | Pending verification | None | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Which county health page is official for each county, and whether a food permit applies. The rule has no verified link. |
| 2 | Register for employer taxes with Employment Security (`esd`) | Employment Security Dept. | [ESD, Quarterly reports](https://esd.wa.gov/employer-requirements/quarterly-reports) | Pending verification | None | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | The step says "register", but the linked ESD guide does not state registration. See docs/esd-card-draft-for-review.md. |
| 3 | Check city and county requirements (`local`) | Your city and county | [DOR, City endorsements](https://dor.wa.gov/manage-business/city-endorsements) | Pending verification | None | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | City and county requirements differ by place. Confirm what the demo may say, and which county or city pages are verified. |
| 4 | File your business entity with the Secretary of State (`sos`) | Secretary of State | [DOR, Choose an ownership structure](https://dor.wa.gov/open-business/choose-ownership-structure) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |
| 5 | Apply for your Washington business license (`dor`) | Dept. of Revenue (BLS) | [DOR, Apply for a business license](https://dor.wa.gov/open-business/apply-business-license) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |
| 6 | Confirm your list with the official Business Licensing Wizard (`wizard`) | Dept. of Revenue (BLS) | [DOR, Open a business](https://dor.wa.gov/open-business) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |
| 7 | Register as a contractor with Labor & Industries (`lni-contractor`) | Labor & Industries | [L&I, Register as a Contractor](https://lni.wa.gov/licensing-permits/contractors/register-as-a-contractor/) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |
| 8 | Set up workers' compensation insurance (`lni-wc`) | Labor & Industries | [L&I, Do I Need a Workers' Comp Account?](https://lni.wa.gov/insurance/insurance-requirements/do-i-need-a-workers-comp-account/) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |
| 9 | Report new hires to DSHS (`dshs`) | DSHS | [DSHS, New Hire Reporting](https://www.dshs.wa.gov/family-food-and-housing-services/child-support/employer-resources/new-hire-reporting) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |
| 10 | Review rules for independent contractors (`ic`) | Labor & Industries | [L&I, Independent Contractors](https://lni.wa.gov/insurance/insurance-requirements/independent-contractors/) | Source checked | 2026-10-26 | [NEEDS HUMAN INPUT: content owner] | [NEEDS HUMAN INPUT: reviewer] | Re-read the source page. Confirm the fees, links, timing and eligibility text on the card match it. Then record the review and publish with your name. |

## Notes from each rule's verification record

- **Check for a county health department permit** (pending): Pending verification. The county health permit statement came from the state business checklist read earlier in this project. That site returned 502 on 2026-10-26 so it could not be re-read. The exact county source has not been reviewed.
- **Register for employer taxes with Employment Security** (pending): ESD pages read on 2026-10-26: the quarterly reports page and the employers' guide to paying taxes. They describe the steps, but no reviewer has confirmed them yet.
- **Check city and county requirements** (pending): Pending verification. The exact city or county source (for example the City of Bellevue) has not been reviewed. No local requirements or links are asserted.
- **File your business entity with the Secretary of State** (checked): DOR page text read on 2026-10-26 and supports the entity-filing rule.
- **Apply for your Washington business license** (checked): DOR page text re-read on 2026-10-26 and the timing statements compared with the page. The mail-with-endorsements time is not stated and is marked Needs verification.
- **Confirm your list with the official Business Licensing Wizard** (checked): DOR page text read on 2026-10-26. The wizard page loads but its questions were not reviewed.
- **Register as a contractor with Labor & Industries** (checked): L&I page text re-read in full on 2026-10-26 and the fee, bond, insurance and timing figures compared with the page. Processing-time statements that overlap are marked Needs verification.
- **Set up workers' compensation insurance** (checked): L&I page text read on 2026-10-26.
- **Report new hires to DSHS** (checked): DSHS and ESD page text read on 2026-10-26.
- **Review rules for independent contractors** (checked): L&I page text read on 2026-10-26.

## Suggested order

1. The three pending rules, ESD first (a draft is ready).
2. The seven source-checked rules, so each has a named reviewer on record.
3. Name a content owner for every rule. All ten currently show the placeholder.
