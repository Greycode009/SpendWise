import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <div className="pt-10">
      <EmptyState
        icon={Compass}
        title="Page not found"
        text="That page doesn't exist."
        action={
          <Link to="/" className="btn-primary btn">
            Go home
          </Link>
        }
      />
    </div>
  );
}
