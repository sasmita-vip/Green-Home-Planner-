import { useEffect, useState } from 'react';
import { href, useRoute } from './lib/router';
import { applyTheme, initialTheme, getSavedHousehold } from './lib/session';
import { Landing } from './pages/Landing';
import { NewPlan } from './pages/NewPlan';
import { PlanView } from './pages/PlanView';
import { Impact } from './pages/Impact';
import { Assumptions } from './pages/Assumptions';
import { ResponsibleAI } from './pages/ResponsibleAI';
import { StateBlock } from './components/ui';

const navLinks = [
  { path: '/new', label: 'New plan' },
  { path: '/impact', label: 'Impact' },
  { path: '/assumptions', label: 'Assumptions' },
  { path: '/responsible-ai', label: 'Responsible AI' },
];

export default function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.title =
      route.name === 'plan'
        ? 'Your plan — Green Home Planners'
        : 'Green Home Planners — a practical plan for a cooler, cheaper home';
  }, [route]);

  const saved = getSavedHousehold();

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b hairline bg-mint-100/85 backdrop-blur dark:bg-pine-900/85">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
          <a href={href('/')} className="group flex items-baseline gap-2">
            <span className="font-display text-lg leading-none tracking-tightest">Green Home</span>
            <span className="font-display text-lg leading-none tracking-tightest text-accent dark:text-accent-light">
              Planners
            </span>
          </a>

          <div className="flex items-center gap-1 sm:gap-2">
            <nav aria-label="Main">
              <ul className="flex flex-wrap items-center gap-1 sm:gap-2">
                {navLinks.map((link) => (
                  <li key={link.path}>
                    <a
                      href={href(link.path)}
                      className="px-2 py-1.5 text-sm text-pine-600 hover:text-pine-900 dark:text-mint-200/80 dark:hover:text-mint-50"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                {saved ? (
                  <li>
                    <a
                      href={href(`/plan/${saved}`)}
                      className="px-2 py-1.5 text-sm text-accent-dark hover:underline dark:text-accent-light"
                    >
                      My plan
                    </a>
                  </li>
                ) : null}
              </ul>
            </nav>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="ml-1 border border-pine-800/20 px-2 py-1 text-xs dark:border-mint-200/25"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-content px-4 pb-16 sm:px-6">
        {route.name === 'home' ? <Landing /> : null}
        {route.name === 'new' ? <NewPlan /> : null}
        {route.name === 'plan' ? <PlanView key={route.id} id={route.id} /> : null}
        {route.name === 'impact' ? <Impact /> : null}
        {route.name === 'assumptions' ? <Assumptions /> : null}
        {route.name === 'responsible-ai' ? <ResponsibleAI /> : null}
        {route.name === 'not-found' ? (
          <StateBlock
            kind="empty"
            title="That page is not here"
            body="The link may be old, or the plan may belong to another browser."
            action={
              <a className="btn-primary" href={href('/')}>
                Go to the start
              </a>
            }
          />
        ) : null}
      </main>

      <footer className="border-t hairline">
        <div className="mx-auto flex max-w-content flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-pine-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-mint-200/60">
          <p>
            Chennai and Coimbatore only · planning estimates, not quotes · tariffs unverified · usage model trained on
            synthetic data.
          </p>
          <p>
            <a className="link" href={href('/responsible-ai')}>
              How this was built
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
