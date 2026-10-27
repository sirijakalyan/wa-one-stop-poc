import { useCallback, useState } from 'react';
import { api, useLoad } from '../api.js';
import { ErrorNote } from './Parts.jsx';

// Evidence behind "Pending verification". Recording a review or a county page does not change
// any rule's status or approval. Names only for reviewers. No personal data in notes.
export default function EvidencePanel({ rules }) {
  const [ruleId, setRuleId] = useState(rules[0]?.id || '');
  const fetchReviews = useCallback(() => api.sourceReviews(), []);
  const fetchCounties = useCallback(() => api.countySources(), []);
  const reviews = useLoad(fetchReviews);
  const counties = useLoad(fetchCounties);
  const rule = rules.find((r) => r.id === ruleId);

  const [review, setReview] = useState({ sourceUrl: '', reviewedBy: '', result: 'pending', notes: '' });
  const [county, setCounty] = useState({ county: '', officialUrl: '', reviewedBy: '', status: 'pending' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function run(fn, success, after) {
    setErr('');
    setMsg('');
    try {
      await fn();
      setMsg(success);
      await after();
    } catch (e) {
      setErr(e.message);
    }
  }
  const titleOf = (id) => rules.find((r) => r.id === id)?.title || id;
  const countyName = (c) => `${String(c).replace(/\b[a-z]/g, (m) => m.toUpperCase())} County`;
  const day = (iso) => String(iso || '').slice(0, 10);
  const recent = (reviews.data?.reviews || []).slice(0, 8);

  return (
    <section aria-labelledby="evidence-h">
      <h2 id="evidence-h">Evidence for Pending verification</h2>
      <p className="note">
        Recording a review or a county page does not change any rule status or approval. A named reviewer still publishes in the editor above.
        Enter a reviewer name only. Do not put personal details in notes.
      </p>
      <ErrorNote message={err} />
      {msg && <p className="ok" role="status">{msg}</p>}

      <div className="two-col">
        <form className="panel" aria-labelledby="sr-h" onSubmit={(e) => {
          e.preventDefault();
          run(() => api.addSourceReview({ ruleId, ...review, sourceUrl: review.sourceUrl || rule?.source?.url || '' }), 'Source review recorded.', async () => {
            setReview({ sourceUrl: '', reviewedBy: '', result: 'pending', notes: '' });
            await reviews.reload();
          });
        }}>
          <h3 id="sr-h">Record a source review</h3>
          <div className="field">
            <label htmlFor="sr-rule">Rule</label>
            <select id="sr-rule" value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
              {rules.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sr-url">Official page reviewed (https)</label>
            <input id="sr-url" type="text" value={review.sourceUrl} placeholder={rule?.source?.url || ''} onChange={(e) => setReview({ ...review, sourceUrl: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sr-by">Who reviewed this page</label>
            <input id="sr-by" type="text" maxLength={80} value={review.reviewedBy} onChange={(e) => setReview({ ...review, reviewedBy: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="sr-result">Result</label>
            <select id="sr-result" value={review.result} onChange={(e) => setReview({ ...review, result: e.target.value })}>
              <option value="pending">Pending: page does not yet support the rule</option>
              <option value="checked">Checked: page supports the rule</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sr-notes">Notes</label>
            <textarea id="sr-notes" maxLength={1000} value={review.notes} onChange={(e) => setReview({ ...review, notes: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Record review</button>
        </form>

        <form className="panel" aria-labelledby="cs-h" onSubmit={(e) => {
          e.preventDefault();
          run(() => api.saveCountySource(county.county, { officialUrl: county.officialUrl, reviewedBy: county.reviewedBy, status: county.status }), 'County page saved.', async () => {
            setCounty({ county: '', officialUrl: '', reviewedBy: '', status: 'pending' });
            await counties.reload();
          });
        }}>
          <h3 id="cs-h">Save a county health page</h3>
          <div className="field">
            <label htmlFor="cs-county">County</label>
            <input id="cs-county" type="text" maxLength={40} placeholder="For example King" value={county.county} onChange={(e) => setCounty({ ...county, county: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cs-url">Official county page (https)</label>
            <input id="cs-url" type="text" value={county.officialUrl} onChange={(e) => setCounty({ ...county, officialUrl: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cs-by">Who reviewed the county page</label>
            <input id="cs-by" type="text" maxLength={80} value={county.reviewedBy} onChange={(e) => setCounty({ ...county, reviewedBy: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cs-status">Status</label>
            <select id="cs-status" value={county.status} onChange={(e) => setCounty({ ...county, status: e.target.value })}>
              <option value="pending">Pending: page not yet reviewed</option>
              <option value="verified">Verified: reviewed and correct</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Save county page</button>
          <p className="hint">A county link may be shown only after its page is Verified. This screen only records it. The checklist does not show county links yet.</p>
        </form>
      </div>

      <h3>Recent source reviews ({reviews.data?.reviews?.length ?? 0})</h3>
      {recent.length === 0 ? <p className="hint">No reviews recorded yet.</p> : (
        <div className="table-scroll">
          <table className="stack">
            <thead><tr><th scope="col">Rule</th><th scope="col">Result</th><th scope="col">Reviewer</th><th scope="col">Date</th><th scope="col">Notes</th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{titleOf(r.ruleId)}</td>
                  <td data-label="Result"><span className={`pill ${r.result === 'checked' ? 'applies' : 'pending'}`}>{r.result === 'checked' ? 'Checked' : 'Pending'}</span></td>
                  <td data-label="Reviewer">{r.reviewedBy}</td>
                  <td data-label="Date">{day(r.reviewedAt)}</td>
                  <td data-label="Notes">{r.notes || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>County health pages ({counties.data?.counties?.length ?? 0})</h3>
      {(counties.data?.counties || []).length === 0 ? <p className="hint">No county pages recorded yet.</p> : (
        <div className="table-scroll">
          <table className="stack">
            <thead><tr><th scope="col">County</th><th scope="col">Status</th><th scope="col">Reviewer</th><th scope="col">Date</th><th scope="col">Official page</th></tr></thead>
            <tbody>
              {counties.data.counties.map((c) => (
                <tr key={c.county}>
                  <td>{countyName(c.county)}</td>
                  <td data-label="Status"><span className={`pill ${c.status === 'verified' ? 'applies' : 'pending'}`}>{c.status === 'verified' ? 'Verified' : 'Pending'}</span></td>
                  <td data-label="Reviewer">{c.reviewedBy}</td>
                  <td data-label="Date">{day(c.reviewedAt)}</td>
                  <td data-label="Official page"><span className="mono-small">{c.officialUrl}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
