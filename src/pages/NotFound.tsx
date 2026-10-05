import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl sm:text-4xl">Page not found</h1>
      <p className="bx-prose mt-3">There is no page at this address. Try <Link to="/read">the report</Link>, <Link to="/search">search</Link> or <Link to="/">the front page</Link>.</p>
    </div>
  );
}
