import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="empty">
      <h1 tabIndex={-1}>Page not found</h1>
      <p>We could not find that page in the demo.</p>
      <Link className="btn btn-primary" to="/">Back to home</Link>
    </section>
  );
}
