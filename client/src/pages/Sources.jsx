import { useCallback } from 'react';
import { api, useLoad } from '../api.js';
import ExternalLink from '../components/ExternalLink.jsx';
import { statusLabel, approvalLabel, OWNER_FALLBACK, REVIEWER_FALLBACK } from '../components/Parts.jsx';

const SOURCES = [
  ['DOR, Open a business', 'https://dor.wa.gov/open-business', 'Starting point. Explains that the Business Licensing Wizard returns the licenses your business may need.'],
  ['DOR, Apply for a business license', 'https://dor.wa.gov/open-business/apply-business-license', 'When registration is required, and how to apply.'],
  ['DOR, Choose an ownership structure', 'https://dor.wa.gov/open-business/choose-ownership-structure', 'Which structures file with the Secretary of State first. Sole proprietorships are listed without that filing.'],
  ['DOR, City endorsements', 'https://dor.wa.gov/manage-business/city-endorsements', 'Cities whose endorsements can be added to the state filing. Unlisted cities: contact the city.'],
  ['Secretary of State, Corporations & Charities', 'https://www.sos.wa.gov/corporations-charities', 'Where entity filings are made. Does not state who must file.'],
  ['L&I, Register as a Contractor', 'https://lni.wa.gov/licensing-permits/contractors/register-as-a-contractor/', 'Construction contractor registration, bond and insurance, and trades with extra requirements.'],
  ['L&I, Do I Need a Workers\' Comp Account?', 'https://lni.wa.gov/insurance/insurance-requirements/do-i-need-a-workers-comp-account/', 'Workers\' compensation for businesses that have workers.'],
  ['L&I, Independent Contractors', 'https://lni.wa.gov/insurance/insurance-requirements/independent-contractors/', 'Tests for whether independent contractors need coverage.'],
  ['ESD, Quarterly reports', 'https://esd.wa.gov/employer-requirements/quarterly-reports', 'Employers file two tax and wage reports each quarter.'],
  ['ESD, Unemployment taxes', 'https://esd.wa.gov/employer-requirements/unemployment-taxes', 'Paying unemployment taxes, penalties and reimbursable employers.'],
  ['DSHS, New Hire Reporting', 'https://www.dshs.wa.gov/family-food-and-housing-services/child-support/employer-resources/new-hire-reporting', '20-day new hire reporting, rehire definition and tribal exemption.'],
  ['DOR, My DOR sign-in (action page)', 'https://secure.dor.wa.gov/home/Login', 'Where the online Business License Application is started. Needs a Secure Access Washington user ID. Not tested past the sign-in page.'],
  ['Secretary of State, Start a Domestic (WA) Business (action page)', 'https://www.sos.wa.gov/corporations-charities/business-entities/start-or-register-business/start-domestic-wa-business', 'Choose an entity type and follow its filing instructions. The filing system needs an account.'],
  ['L&I, How to Get a Workers\' Compensation Account (action page)', 'https://lni.wa.gov/insurance/insurance-requirements/how-to-get-a-workers-compensation-account', 'Says the account is obtained through the DOR business license application.'],
  ['ESD, Employers\' guide to paying taxes (action page)', 'https://esd.wa.gov/employer-requirements/unemployment-taxes/employers-guide-paying-taxes', 'Steps for new employers, quarterly reports and payments. Still Pending verification.'],
  ['DOR, Business Licensing Wizard', 'https://secure.dor.wa.gov/gteunauth/?Link=wiz', 'Official follow-up tool. Confirm your actual requirements here. Needs cookies. Its questions were not reviewed.'],
];

export default function Sources() {
  const fetchRules = useCallback(() => api.rules(), []);
  const { data } = useLoad(fetchRules);
  const rules = data?.rules ?? [];

  return (
    <>
      <h1 tabIndex={-1}>Sources and how this demo works</h1>
      <p className="lead">Every requirement here points to an official page. Anything not tied to an official source is left out.</p>

      <h2>Official pages used</h2>
      <p className="hint">All pages are Washington State agency pages. Each link opens in a new tab. If a page does not open, the agency site may be down. Try again later or search for the agency name. Opening a page is not the same as verifying a rule. Business.wa.gov returned 502 Bad Gateway on October 26, 2026, so it is not linked.</p>
      <div className="table-scroll">
        <table className="stack">
          <thead><tr><th scope="col">Source</th><th scope="col">What it supports</th></tr></thead>
          <tbody>
            {SOURCES.map(([name, url, use]) => (
              <tr key={url}>
                <td><ExternalLink href={url}>{name}</ExternalLink><br /><span className="mono-small">{url}</span></td>
                <td data-label="What it supports">{use}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Business Licensing Wizard</h2>
      <p>The wizard is the official follow-up tool. This demo is a sketch from a few answers. Confirm your actual requirements in the wizard and with each agency, and with your city and county.</p>
      <p>
        <ExternalLink className="btn btn-sm" href="https://secure.dor.wa.gov/gteunauth/?Link=wiz" fallback="If the wizard does not load, turn on cookies or start at dor.wa.gov/open-business." showFallback>Open the Business Licensing Wizard</ExternalLink>
      </p>

      <div className="two-col">
        <div>
          <h2>What is simulated</h2>
          <ul>
            <li>The business-type suggestion is a keyword match, not an AI model.</li>
            <li>Status tracking is a checkbox you tick yourself. No agency feed is connected.</li>
            <li>Notifications and the email switch are simulated. Nothing is sent.</li>
            <li>There is no sign-in, no local city or county rules and no fee amounts. A county you enter only names your county in the county health step. It confirms nothing.</li>
          </ul>
        </div>
        <div>
          <h2>What this demo will not do</h2>
          <ul>
            <li>File an application for you.</li>
            <li>Give legal or tax advice.</li>
            <li>Replace the Business Licensing Service or the Secretary of State.</li>
            <li>Show a rule that has no official source.</li>
          </ul>
        </div>
      </div>

      <h2>Rule records ({rules.length})</h2>
      <dl className="legend">
        <dt>Checked</dt><dd>Someone read the official page and it supports the rule. This is not an approval.</dd>
        <dt>Approved</dt><dd>A named reviewer approved the rule record in the admin screen. No rule is Approved until a person completes that review.</dd>
        <dt>Pending verification</dt><dd>The exact official source has not been reviewed. Nothing is asserted beyond what is shown.</dd>
      </dl>
      <div className="table-scroll">
        <table className="stack">
          <thead>
            <tr>
              <th scope="col">Requirement</th><th scope="col">Source title and URL</th><th scope="col">What it supports</th>
              <th scope="col">Status</th><th scope="col">Last verified</th><th scope="col">Owner</th><th scope="col">Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td data-label="Source title and URL"><ExternalLink href={r.source.url}>{r.source.label}</ExternalLink><br /><span className="mono-small">{r.source.url}</span></td>
                <td data-label="What it supports">{r.supports}{r.limits ? <><br /><em>Limits: {r.limits}</em></> : null}</td>
                <td data-label="Status">{statusLabel(r.verification)}<br /><span className="mono-small">{approvalLabel(r)}</span></td>
                <td data-label="Last verified">{r.lastVerified || 'Not yet verified'}</td>
                <td data-label="Owner">{r.owner || OWNER_FALLBACK}</td>
                <td data-label="Reviewer">{r.reviewer || REVIEWER_FALLBACK}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
