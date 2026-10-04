import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="hud-panel mx-auto mt-16 max-w-md p-8 text-center">
      <p className="font-hud text-4xl text-accent">404</p>
      <p className="my-3 text-muted">That sector of the toolkit does not exist.</p>
      <Link to="/" className="hud-btn">
        Back to Mission Control
      </Link>
    </div>
  );
}
