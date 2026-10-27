import { Link } from 'react-router-dom';
import { DISCLAIMER_SHORT, DISCLAIMER_TEXT } from '../disclaimer.js';

export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <p className="foot-disclaimer" data-testid="footer-disclaimer"><strong>{DISCLAIMER_SHORT}.</strong> {DISCLAIMER_TEXT}</p>
        <p>Every requirement shown comes from an official agency page and carries its source. Confirm with the relevant agency before you apply.</p>
        <p className="foot-links"><Link to="/sources">Sources</Link><span aria-hidden="true"> · </span><Link to="/admin">Admin rules (for administrators)</Link></p>
      </div>
    </footer>
  );
}
