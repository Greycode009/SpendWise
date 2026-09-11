import { LogoMark } from './Logo.jsx';
import { Spinner } from './ui.jsx';

export default function Splash({ message = 'Loading…' }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <LogoMark className="size-16" />
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Spinner className="size-4" />
          {message}
        </div>
      </div>
    </div>
  );
}
