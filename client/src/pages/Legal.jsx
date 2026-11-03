import { Link } from 'react-router-dom';
import { useT } from '../i18n.js';

// Plain-language Terms and Privacy pages. DRAFT: they describe what this demo does today and must be reviewed by a lawyer and the agency before real use.
const TERMS = [
  ['What this is', 'WA Business One-Stop-Shop is a demonstration of a helper for people starting a business in Washington State. It builds a checklist from written rules and official agency pages. It is a helpful guide, not legal, tax or financial advice.'],
  ['Check with the agency', 'Rules, fees and deadlines can change. Please confirm every requirement and date with the agency before you act. A step marked "Source checked" means a person read the agency page on that date. It is not an approval from the agency. "Pending verification" means it has not been checked yet.'],
  ['No agency connection', 'This demo is not connected to any agency system. Your progress is self-reported, and the app does not file, apply or pay for anything for you.'],
  ['The AI guide', 'The guide listens and asks questions. Written rules, not the AI, decide what applies to your business. Answers outside the written rules are labeled general information and may be wrong. Do not rely on them as official advice.'],
  ['Your account', 'Keep your password private. Tell us if you think someone else used your account. You can stop using the demo at any time.'],
  ['Fair use', 'Please use the demo for its intended purpose. Do not try to break it, overload it, or look at other people\'s information.'],
  ['No promises', 'The demo is provided as is, without promises that it is complete, current or always available. It may change or be turned off.'],
];

const PRIVACY = [
  ['What we collect', 'The answers you give about your business (such as the business structure, the kind of business, city and county, and yes or no questions). If you create an account: your name, email address and a protected form of your password. If you turn on renewal reminders: the renewal dates you enter. We do not ask for street addresses, tax numbers or bank details.'],
  ['What is kept', 'The guide does not keep your conversation. Only a plan you choose to save is kept. Saved plans, notifications and settings are tied to your account, or to this browser if you are not signed in. We also keep a short activity log, such as "saved a plan" or "marked a step done", which an administrator can see.'],
  ['Who can see it', 'You can see your own information. Administrators of the demo can see accounts, saved answers, checklist progress and activity so they can run and improve it. We do not sell your information.'],
  ['Questions you type', 'When you ask a question that the written rules do not cover, your question and the last few messages may be sent to an AI service to write a general answer. Do not type names, addresses, tax numbers or other personal details into the chat.'],
  ['Voice', 'If you use Talk, your browser\'s speech tools turn your voice into text. Depending on your browser, the audio may be processed by the browser\'s provider. Voice is off when you choose Type. You can mute the voice at any time.'],
  ['Email', 'If you turn on reminders, we email your account address before a renewal date you entered. Each email has a link to stop them. Stopping removes your address from reminders.'],
  ['This browser', 'The site stores a few things in your browser, such as an anonymous visitor ID, your sign-in session and an unsaved draft, so the app works between visits.'],
  ['Your choices', 'You can edit your answers, start over (which deletes your saved plan), stop email reminders, or ask for your account to be deleted. [Contact details to be added by the demo owner.]'],
  ['Changes', 'We may update this page. The date below shows when it last changed.'],
];

export default function Legal({ kind }) {
  const t = useT();
  const terms = kind === 'terms';
  const rows = terms ? TERMS : PRIVACY;
  return (
    <div className="panel legal">
      <h1 tabIndex={-1}>{terms ? t('legal.terms') : t('legal.privacy')}</h1>
      <p className="note" role="note">{t('legal.draft')}</p>
      {t.lang === 'es' && <p className="hint" lang="en">{t('legal.english')}</p>}
      <div lang="en">
        {rows.map(([h, p]) => (
          <section key={h}>
            <h2>{h}</h2>
            <p>{p}</p>
          </section>
        ))}
      </div>
      <p className="hint">Last updated: November 3, 2026.</p>
      <p><Link to={terms ? '/privacy' : '/terms'}>{terms ? t('legal.privacy') : t('legal.terms')}</Link></p>
    </div>
  );
}
