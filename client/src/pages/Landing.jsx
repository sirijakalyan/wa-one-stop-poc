import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useLoad } from '../api.js';
import { ErrorNote } from '../components/Parts.jsx';
import Icon from '../components/Icon.jsx';
import GuideArt from '../components/GuideArt.jsx';

const SAMPLE_ICON = { home: 'home', restaurant: 'utensils', contractor: 'hammer' };
const GREETING = "Hi, I'm here to help you start your Washington business. Tell me what you want to do, in your own words.";

// Home: the guide itself, three equal ways in, and a one-sentence start.
// What the owner types goes to the guide through the router's history state, never through the address bar.
export default function Landing() {
  const navigate = useNavigate();
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
              <p>{GREETING}</p>
            </div>
            <GuideArt />
            <p className="ai-label"><Icon name="chat" size={16} /> You&apos;re talking to an AI guide</p>
          </div>

          <div className="hero-copy">
            <h1 id="hero-title" tabIndex={-1}>Start your Washington business</h1>
            <p className="lead">
              Say what you want to build. The guide takes notes, you confirm each fact, and a plan to opening day builds in front of you.
            </p>

            <ul className="ways-in" aria-label="Choose how to start">
              <li>
                <button type="button" className="btn btn-primary" onClick={() => open({ mode: 'talk' })}>Talk to me</button>
              </li>
              <li>
                <button type="button" className="btn btn-primary" onClick={() => open({ mode: 'type' })}>Type instead</button>
              </li>
              <li>
                <Link className="btn btn-primary" to="/questionnaire">Use the step-by-step form</Link>
              </li>
            </ul>
            <p className="hero-note">All three give you the same plan. You can switch at any time. No account or sign-in needed.</p>

            <form className="one-sentence" onSubmit={startWithSentence}>
              <label htmlFor="one-sentence">Describe your business in one sentence</label>
              <div className="one-sentence-row">
                <input
                  id="one-sentence"
                  type="text"
                  maxLength={300}
                  autoComplete="off"
                  placeholder="I want to open a food truck in Spokane and hire two people"
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={!sentence.trim()} aria-label="Start with this sentence">
                  <Icon name="arrow" size={20} />
                </button>
              </div>
            </form>
            <p className="privacy-note">
              We do not ask for names, addresses or tax numbers. The guide does not store your conversation. Only a plan you choose to save is kept, for this browser.
            </p>
          </div>
        </div>
      </section>

      <h2 id="samples" tabIndex={-1} style={{ marginTop: 0 }}>Or start from a sample business</h2>
      <p className="hint">Each one starts the guide with a short story already told. These are made-up businesses.</p>
      <ErrorNote message={error} />
      <ul className="sample-chips">
        {samples.map((s) => (
          <li key={s.id}>
            <button type="button" className="sample-chip" onClick={() => open({ sample: s.id, start: s.story, mode: 'type' })}>
              <span className="icon-tile"><Icon name={SAMPLE_ICON[s.id] || 'building'} size={22} /></span>
              <span>
                <strong>{s.title}</strong>
                <span className="sample-blurb">{s.blurb}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h2>How it works</h2>
      <ol className="how">
        <li className="how-card"><span className="icon-tile"><Icon name="chat" /></span><h3>Tell your story</h3><p>Say it or type it, or fill in the form. The guide takes notes in a card you can see and edit.</p></li>
        <li className="how-card"><span className="icon-tile"><Icon name="checkCircle" /></span><h3>Confirm each fact</h3><p>Nothing goes on your plan until you say it is right. Written rules, not the AI, decide what applies.</p></li>
        <li className="how-card"><span className="icon-tile"><Icon name="clock" /></span><h3>See your road to opening day</h3><p>Steps appear with the answer behind each one, and a timeline uses only the agencies&apos; own published times.</p></li>
      </ol>

      <details className="read-guide">
        <summary>How each step is labeled and where the information comes from</summary>
        <ul className="labels">
          <li><span className="pill applies">Applies to you</span><span>Your confirmed answers match a written rule, and its official source has been checked.</span></li>
          <li><span className="pill maybe">May apply, confirm</span><span>Your answers are unsure, so confirm with the agency.</span></li>
          <li><span className="pill pending">Pending verification</span><span>Your answers point to this step, but the requirement is not confirmed yet.</span></li>
        </ul>
        <ul className="facts-light">
          <li><strong>Written rules decide.</strong> The AI guide never decides what you legally need. It listens, asks and explains, and you confirm every fact.</li>
          <li><strong>Every item shows its source.</strong> Each step links to the official page it came from and says whether the source has been checked.</li>
          <li><strong>We point you to the agency.</strong> You apply with the Business Licensing Service and the Secretary of State. We do not apply for you.</li>
        </ul>
        <p><Link to="/sources">See all sources</Link></p>
      </details>
    </>
  );
}
