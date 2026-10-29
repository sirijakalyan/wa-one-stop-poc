import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { ErrorNote } from '../components/Parts.jsx';
import Icon from '../components/Icon.jsx';
import GuideArt from '../components/GuideArt.jsx';
import { SAMPLES_ES, useT } from '../i18n.js';
import { canSpeak } from '../voice.js';
import { useApp } from '../AppContext.jsx';
import { answersFromCard, confirmedCount } from '../guideCard.js';
import { blankAnswers } from '../questions.js';
import Guide from './Guide.jsx';
import Questionnaire from './Questionnaire.jsx';

const SAMPLE_ICON = { home: 'home', restaurant: 'utensils', contractor: 'hammer' };

// Home: the guide itself, three equal ways in, and a one-sentence start.
// What the owner types goes to the guide through the router's history state, never through the address bar.
export default function Landing() {
  const t = useT();
  const { guide, live, answers, setAnswers, setLabel, setStep, setCatsAuto } = useApp();
  const [mode, setMode] = useState(canSpeak() ? 'talk' : 'type'); // 'talk' by default so the guide greets out loud; null | 'talk' | 'type' | 'form': the guide and the form both live on this page
  const [startReq, setStartReq] = useState(null);
  const workRef = useRef(null);
  const reqId = useRef(0);
  const fetchSamples = useCallback(() => api.samples(), []);
  const { data, error } = useLoad(fetchSamples);
  const [sentence, setSentence] = useState('');
  const samples = data?.samples ?? [];

  // Switching to the form carries over what the guide has confirmed, but only if the form is still empty.
  function choose(next) {
    if (next === 'form' && mode !== 'form' && confirmedCount(guide.card) > 0 && JSON.stringify(answers) === JSON.stringify(blankAnswers())) {
      setAnswers(answersFromCard(guide.card));
      setLabel('');
      setCatsAuto(false);
      setStep(0);
    }
    setMode(next);
  }
  const send = (text, next = 'type') => {
    reqId.current += 1;
    setStartReq({ text, id: `req${reqId.current}` });
    setMode(next === 'talk' ? 'talk' : 'type');
  };
  function startWithSentence(e) {
    e.preventDefault();
    const text = sentence.trim();
    if (text) { send(text, mode === 'talk' ? 'talk' : 'type'); setSentence(''); }
  }
  const firstMode = useRef(true);
  useEffect(() => {
    if (firstMode.current) { firstMode.current = false; return; } // opening the page must not scroll or steal focus
    if (mode) workRef.current?.focus({ preventScroll: false });
  }, [mode]);

  return (
    <>
      <section className="hero guide-hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="guide-stage">
            <div className={`guide-bubble${live.speaking ? ' is-speaking' : ''}${live.listening && !live.speaking ? ' is-listening' : ''}`} data-testid="greeting">
              <p>{live.text && live.role === 'guide' ? live.text : t('home.greeting')}</p>
              {(live.speaking || live.listening) && (
                <p className="live-status" aria-hidden="true">
                  <span className="bars"><i /><i /><i /><i /></span>
                  {live.speaking ? t('voice.speakingShort') : t('voice.listening')}
                </p>
              )}
            </div>
            <GuideArt />
            <p className="ai-label"><Icon name="chat" size={16} /> {t('home.aiLabel')}</p>
          </div>

          <div className="hero-copy">
            <h1 id="hero-title" tabIndex={-1}>{t('home.title')}</h1>

            <ul className="ways-in" aria-label={t('home.ways')}>
              <li>
                <button type="button" className={`btn btn-primary${mode === 'talk' ? ' is-current' : ''}`} aria-pressed={mode === 'talk'} onClick={() => choose('talk')}>{t('home.talk')}</button>
              </li>
              <li>
                <button type="button" className={`btn btn-primary${mode === 'type' ? ' is-current' : ''}`} aria-pressed={mode === 'type'} onClick={() => choose('type')}>{t('home.type')}</button>
              </li>
              <li>
                <button type="button" className={`btn btn-primary${mode === 'form' ? ' is-current' : ''}`} aria-pressed={mode === 'form'} onClick={() => choose('form')}>{t('home.form')}</button>
              </li>
            </ul>

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
          </div>
        </div>
      </section>

      <section className="workspace" id="workspace" ref={workRef} tabIndex={-1} aria-label={t('mode.title')}>
        {mode === 'form' ? <Questionnaire embedded /> : null}
        {mode === 'talk' || mode === 'type' ? <Guide embedded mode={mode} start={startReq} /> : null}
        {!mode ? <p className="hint workspace-hint">{t('mode.pick')}</p> : <p className="hint workspace-hint">{t('mode.kept')}</p>}
        <p className="hint workspace-hint">{t('home.lead')} {t('home.waysNote')}</p>
        <p className="privacy-note workspace-hint">{t('home.privacy')}</p>
      </section>

      {t('draft.note') ? <p className="draft-note" role="note">{t('draft.note')}</p> : null}
      <h2 id="samples" tabIndex={-1} style={{ marginTop: 0 }}>{t('home.samplesTitle')}</h2>
      <p className="hint">{t('home.samplesHint')}</p>
      <ErrorNote message={error} />
      <ul className="sample-chips">
        {samples.map((s) => (
          <li key={s.id}>
            <button type="button" className="sample-chip" onClick={() => send((t.lang === 'es' && SAMPLES_ES[s.id]?.story) || s.story, mode === 'talk' ? 'talk' : 'type')}>
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
