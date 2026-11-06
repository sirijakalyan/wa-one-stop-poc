import { useState } from 'react';
import { getBusiness } from '../api.js';
import { feedbackGiven, rememberFeedback, track } from '../insightsClient.js';
import { useT } from '../i18n.js';

const REASONS = ['hard_words', 'too_long', 'missing_step', 'unsure_fit', 'other'];

// "Was this plan clear?" Asked once under each plan. It never blocks the plan. Only the answer and tapped reasons are counted:
// no free text is collected, so nothing personal can be typed in.
export default function PlanFeedback({ bizKey = getBusiness() }) {
  const t = useT();
  const [gone, setGone] = useState(() => feedbackGiven(bizKey));
  const [value, setValue] = useState('');
  const [reasons, setReasons] = useState([]);
  const [thanks, setThanks] = useState(false);
  if (gone && !thanks) return null;
  if (thanks) return <p className="fb-thanks" role="status">{t('fb.thanks')}</p>;

  function send(v, why = []) {
    track('feedback', { value: v, reasons: why });
    rememberFeedback(bizKey);
    setGone(true);
    setThanks(true);
  }
  const toggle = (r) => setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  return (
    <section className="fb" aria-labelledby="fb-q">
      <h2 id="fb-q">{t('fb.q')}</h2>
      <div className="fb-row" role="group" aria-labelledby="fb-q">
        {['yes', 'partly', 'no'].map((v) => (
          <button key={v} type="button" className={`btn btn-quiet${value === v ? ' is-current' : ''}`} aria-pressed={value === v} onClick={() => (v === 'yes' ? send('yes') : setValue(v))}>{t(`fb.${v}`)}</button>
        ))}
      </div>
      {value ? (
        <div className="fb-why">
          <p id="fb-why">{t('fb.why')}</p>
          <ul aria-labelledby="fb-why">
            {REASONS.map((r) => (
              <li key={r}><label className="fb-reason"><input type="checkbox" checked={reasons.includes(r)} onChange={() => toggle(r)} /> {t(`fb.r.${r}`)}</label></li>
            ))}
          </ul>
          <p className="hint">{t('fb.privacy')}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => send(value, reasons)}>{t('fb.send')}</button>
        </div>
      ) : null}
    </section>
  );
}
