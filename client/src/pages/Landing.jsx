import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { ErrorNote } from '../components/Parts.jsx';
import Icon from '../components/Icon.jsx';
import GuideArt from '../components/GuideArt.jsx';
import { SAMPLES_ES, useT } from '../i18n.js';

const SAMPLE_ICON = { home: 'home', restaurant: 'utensils', contractor: 'hammer' };

// Home: the guide itself, three equal ways in, and a one-sentence start.
// What the owner types goes to the guide through the router's history state, never through the address bar.
export default function Landing() {
  const navigate = useNavigate();
  const t = useT();
  const fetchSamples = useCallback(() => api.samples(), []);
  const { data, error } = useLoad(fetchSamples);
  const [sentence, setSentence] = useState('');
  const samples = data?.samples ?? [];

  const open = (state) => navigate('/guide', { state });
  function startWithSentence(e) {
    e.preventDefault();
    const text = sentence.trim();
    if (text) open({ start: text, mode: 'type' });
  }

  return (
    <>
      <section className="hero guide-hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="guide-stage">
            <div className="guide-bubble" data-testid="greeting">
              <p>{t('home.greeting')}</p>
            </div>
            <GuideArt />
            <p className="ai-label"><Icon name="chat" size={16} /> {t('home.aiLabel')}</p>
          </div>

          <div className="hero-copy">
            <h1 id="hero-title" tabIndex={-1}>{t('home.title')}</h1>
            <p className="lead">
              {t('home.lead')}
            </p>

            <ul className="ways-in" aria-label={t('home.ways')}>
              <li>
                <button type="button" className="btn btn-primary" onClick={() => open({ mode: 'talk' })}>{t('home.talk')}</button>
              </li>
              <li>
                <button type="button" className="btn btn-primary" onClick={() => open({ mode: 'type' })}>{t('home.type')}</button>
              </li>
              <li>
                <Link className="btn btn-primary" to="/questionnaire">{t('home.form')}</Link>
              </li>
            </ul>
            <p className="hero-note">{t('home.waysNote')}</p>

            <form className="one-sentence" onSubmit={startWithSentence}>
              <label htmlFor="one-sentence">{t('home.sentenceLabel')}</label>
              <div className="one-sentence-row">
                <input
                  id="one-sentence"
                  type="text"
                  maxLength={300}
                  autoComplete="off"
                  placeholder={t('home.sentencePlaceholder')}
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={!sentence.trim()} aria-label={t('home.sentenceGo')}>
                  <Icon name="arrow" size={20} />
                </button>
              </div>
            </form>
            <p className="privacy-note">
              {t('home.privacy')}
            </p>
          </div>
        </div>
      </section>

      {t('draft.note') ? <p className="draft-note" role="note">{t('draft.note')}</p> : null}
      <h2 id="samples" tabIndex={-1} style={{ marginTop: 0 }}>{t('home.samplesTitle')}</h2>
      <p className="hint">{t('home.samplesHint')}</p>
      <ErrorNote message={error} />
      <ul className="sample-chips">
        {samples.map((s) => (
          <li key={s.id}>
            <button type="button" className="sample-chip" onClick={() => open({ sample: s.id, start: (t.lang === 'es' && SAMPLES_ES[s.id]?.story) || s.story, mode: 'type' })}>
              <span className="icon-tile"><Icon name={SAMPLE_ICON[s.id] || 'building'} size={22} /></span>
              <span>
                <strong>{(t.lang === 'es' && SAMPLES_ES[s.id]?.title) || s.title}</strong>
                <span className="sample-blurb">{(t.lang === 'es' && SAMPLES_ES[s.id]?.blurb) || s.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h2>{t('home.howTitle')}</h2>
      <ol className="how">
        <li className="how-card"><span className="icon-tile"><Icon name="chat" /></span><h3>{t('home.how1')}</h3><p>{t('home.how1t')}</p></li>
        <li className="how-card"><span className="icon-tile"><Icon name="checkCircle" /></span><h3>{t('home.how2')}</h3><p>{t('home.how2t')}</p></li>
        <li className="how-card"><span className="icon-tile"><Icon name="clock" /></span><h3>{t('home.how3')}</h3><p>{t('home.how3t')}</p></li>
      </ol>

      <details className="read-guide">
        <summary>{t('home.labelsSummary')}</summary>
        <ul className="labels">
          <li><span className="pill applies">{t('home.l1')}</span><span>{t('home.l1t')}</span></li>
          <li><span className="pill maybe">{t('home.l2')}</span><span>{t('home.l2t')}</span></li>
          <li><span className="pill pending">{t('home.l3')}</span><span>{t('home.l3t')}</span></li>
        </ul>
        <ul className="facts-light">
          <li><strong>{t('home.f1')}</strong> {t('home.f1t')}</li>
          <li><strong>{t('home.f2')}</strong> {t('home.f2t')}</li>
          <li><strong>{t('home.f3')}</strong> {t('home.f3t')}</li>
        </ul>
        <p><Link to="/sources">{t('home.sources')}</Link></p>
      </details>
    </>
  );
}
