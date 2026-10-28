import ExternalLink from './ExternalLink.jsx';
import SourceDetails from './SourceDetails.jsx';
import Guide from './Guide.jsx';
import Icon from './Icon.jsx';
import { useState } from 'react';
import { dateLocale, useT } from '../i18n.js';

// Long personalised reasons are shown in three lines with a Show more button. All of the text stays available.
function Reason({ text }) {
  const t = useT();
  const [more, setMore] = useState(false);
  const long = String(text || '').length > 170;
  return (
    <div className="why-wrap">
      <p className={`why${long && !more ? ' clamp' : ''}`}>{text}</p>
      {long && (
        <button type="button" className="linklike" aria-expanded={more} onClick={() => setMore((m) => !m)}>{more ? t('item.less') : t('item.more')}</button>
      )}
    </div>
  );
}

// "2026-10-26" -> "Oct 26, 2026". Parsed as UTC so the day never shifts with the viewer's time zone.
function shortDate(iso, lang = 'en') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(dateLocale(lang), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

// County health page for the food permit step. The three states are shown honestly:
// a page a person verified, a page found by search but not verified, or nothing found.
function CountyHealth({ info }) {
  const t = useT();
  const sd = (d) => shortDate(d, t.lang);
  if (info.url) {
    const verified = info.state === 'verified';
    return (
      <div className="county-health" data-testid="county-health" data-state={info.state}>
        <ExternalLink className="btn btn-primary btn-sm" href={info.url}>
          {t('county.page', info.county)}
        </ExternalLink>
        <p className="hint" role="note">
          {verified
            ? `${t('county.by', info.reviewedBy)}${info.reviewedAt ? `${t('county.on')}${sd(info.reviewedAt) || info.reviewedAt}` : ''}.`
            : `${t('county.found')}${info.searchedOn ? `${t('county.on')}${sd(info.searchedOn)}` : ''}${t('county.notChecked')}`}
          {info.agency ? ` ${info.agency}.` : ''}{!verified && info.note ? ` ${info.note}` : ''}
        </p>
      </div>
    );
  }
  return <p className="hint" role="note" data-testid="county-health" data-state={info.state}>{info.message}</p>;
}

// Extra pages found by search for this step. They sit beside the step's own link and are never presented as checked.
function FoundLinks({ links }) {
  const t = useT();
  return (
    <div className="found-links" data-testid="found-links">
      {links.map((l) => (
        <div key={l.url} className="county-health">
          <ExternalLink className="btn btn-sm" href={l.url}>{l.label}</ExternalLink>
          <p className="hint" role="note">
            {t('county.found')}{l.searchedOn ? `${t('county.on')}${shortDate(l.searchedOn, t.lang)}` : ''}{t('link.notChecked')}
            {l.agency ? ` ${l.agency}.` : ''}{l.note ? ` ${l.note}` : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

// One checklist card: title, status label, short reason, one action button, "Mark as done".
// Explanations live in the Guide. Provenance lives in Source details.
export default function ChecklistItem({ item, onToggle }) {
  const t = useT();
  const pending = item.verification?.status === 'pending';
  const sourceChecked = item.verification?.status === 'checked';
  const checkedOn = shortDate(item.lastVerified, t.lang);
  return (
    <li className={`item item--${pending ? 'pending' : item.status === 'applies' ? 'applies' : 'maybe'}${item.done ? ' done' : ''}`}>
      <div className="item-top">
        {pending ? (
          <span className="pill pending">{t('pill.pending')}</span>
        ) : item.status === 'applies' ? (
          <span className="pill applies">{t('pill.applies')}</span>
        ) : (
          <span className="pill maybe">{t('pill.maybe')}</span>
        )}
        {sourceChecked && (
          <span
            className="pill source-checked"
            data-testid="source-checked"
            title={t('pill.checkedTip')}
          >
            <Icon name="check" size={14} />
            {t('pill.checked')}{checkedOn ? ` ${checkedOn}` : ''}
          </span>
        )}
      </div>
      <h3>{item.title}</h3>
      {pending && (
        <p className="pending-note" role="note">
          <Icon name="alert" size={18} />
          <span>{t('item.pendingNote')}</span>
        </p>
      )}
      <Reason text={item.reason} />
      <div className="item-actions">
        <div className="action-block">
          {item.apply?.url ? (
            <ExternalLink className="btn btn-primary btn-sm" href={item.apply.url}>{item.apply.label}</ExternalLink>
          ) : item.countyHealth ? (
            <CountyHealth info={item.countyHealth} />
          ) : (
            <span className="hint" role="note">{item.noLink || t('item.noLink')}</span>
          )}
          {item.foundLinks?.length > 0 && <FoundLinks links={item.foundLinks} />}
        </div>
      </div>
      <Guide item={item} />
      <SourceDetails rule={item} />
      {onToggle && (
        <div className="mark-row">
          <span id={`sim-${item.id}`} className="hint">{t('item.simNote')}</span>
          <label className={`mark-btn${item.done ? ' is-done' : ''}`}>
            <input type="checkbox" checked={item.done} onChange={(e) => onToggle(item.id, e.target.checked)} aria-describedby={`sim-${item.id}`} />
            <span className="mark-box" aria-hidden="true">{item.done ? <Icon name="check" size={16} /> : null}</span>
            {t('item.done')}
          </label>
        </div>
      )}
    </li>
  );
}
