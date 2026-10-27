import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { Chips, ErrorNote } from '../components/Parts.jsx';
import Icon from '../components/Icon.jsx';
import { CAT_LABEL, STRUCT_LABEL } from '../questions.js';

const SAMPLE_ICON = { home: 'home', restaurant: 'utensils', contractor: 'hammer' };

export default function Landing() {
  const navigate = useNavigate();
  const { setAnswers, setLabel, setStep, setCatsAuto } = useApp();
  const fetchSamples = useCallback(() => api.samples(), []);
  const { data, error } = useLoad(fetchSamples);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const samples = data?.samples ?? [];

  async function seeChecklist(s) {
    setBusy(s.id);
    setActionError('');
    try {
      await api.saveChecklist(s.answers, s.title);
      navigate('/checklist');
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy('');
    }
  }
  function walkThrough(s) {
    setAnswers({ ...s.answers, cats: [...s.answers.cats] });
    setLabel(s.title);
    setCatsAuto(false);
    setStep(0);
    navigate('/questionnaire');
  }

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title" tabIndex={-1}>Start your Washington business</h1>
          <p className="lead">
            Answer a few simple questions. We build one checklist of the licenses, permits and registrations that may
            apply to you, with a link to start each one.
          </p>
          <div className="row">
            <Link className="btn btn-primary" to="/questionnaire">Start the questionnaire</Link>
            <a className="btn" href="#samples">Or try a sample business</a>
          </div>
          <p className="hero-note">No account or sign-in needed.</p>
        </div>
      </section>

      <h2 id="samples" tabIndex={-1} style={{ marginTop: 0 }}>Try a sample business</h2>
      <p className="hint">Pick the one closest to yours. It fills in the answers for you, and you can change any of them afterward.</p>
      <ErrorNote message={error || actionError} />
      <ul className="samples">
        {samples.map((s) => (
          <li key={s.id} className="sample">
            <span className="icon-tile"><Icon name={SAMPLE_ICON[s.id] || 'building'} size={24} /></span>
            <h3>{s.title}</h3>
            <p>{s.blurb}</p>
            <Chips
              items={[
                STRUCT_LABEL[s.answers.structure],
                s.answers.hiring === 'yes' ? 'Hiring' : 'No hiring planned',
                ...s.answers.cats.map((c) => CAT_LABEL[c]),
              ]}
            />
            <div className="row">
              <button type="button" className="btn btn-primary btn-sm" disabled={busy === s.id} onClick={() => seeChecklist(s)}>
                See this checklist
              </button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => walkThrough(s)}>
                Walk through the questions
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h2>How it works</h2>
      <ol className="how">
        <li className="how-card"><span className="icon-tile"><Icon name="edit" /></span><h3>Answer a few questions</h3><p>Business structure, what you do, where you work and whether you will hire.</p></li>
        <li className="how-card"><span className="icon-tile"><Icon name="list" /></span><h3>Get your checklist</h3><p>Steps are grouped by phase, each with its agency and one place to start.</p></li>
        <li className="how-card"><span className="icon-tile"><Icon name="file" /></span><h3>Follow the guide</h3><p>Open a step for plain-language help, what to prepare and the source behind it.</p></li>
      </ol>

      <details className="read-guide">
        <summary>How each step is labeled and where the information comes from</summary>
        <ul className="labels">
          <li><span className="pill applies">Applies to you</span><span>Your answers match a written rule, and its official source has been checked.</span></li>
          <li><span className="pill maybe">May apply, confirm</span><span>Your answers are unsure, so confirm with the agency.</span></li>
          <li><span className="pill pending">Pending verification</span><span>Your answers point to this step, but the requirement is not confirmed yet.</span></li>
        </ul>
        <ul className="facts-light">
          <li><strong>Written rules decide.</strong> No AI picks your requirements. A keyword suggestion only helps you describe your business, and you confirm it.</li>
          <li><strong>Every item shows its source.</strong> Each step links to the official page it came from and says whether the source has been checked.</li>
          <li><strong>We point you to the agency.</strong> You apply with the Business Licensing Service and the Secretary of State. We do not apply for you.</li>
        </ul>
        <p><Link to="/sources">See all sources</Link></p>
      </details>
    </>
  );
}
