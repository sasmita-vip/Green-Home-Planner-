import { useEffect, useState } from 'react';
import { request, ApiError } from '../lib/api';
import type { Assumptions } from '../lib/types';
import { href, navigate } from '../lib/router';
import { DEMO_TOKEN, rememberHousehold } from '../lib/session';
import { Notice, UnverifiedBadge } from '../components/ui';

export function Landing() {
  const [config, setConfig] = useState<Assumptions | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    request<Assumptions>('/assumptions', { signal: controller.signal })
      .then(setConfig)
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'The planner could not be reached.');
      });
    return () => controller.abort();
  }, []);

  const startDemo = (id: string) => {
    rememberHousehold(id);
    navigate(`/plan/${id}`);
  };

  return (
    <div>
      <section className="grid gap-10 border-b hairline pb-12 pt-4 md:grid-cols-[1.15fr_0.85fr] md:gap-14 md:pt-10">
        <div>
          <p className="label">Chennai &amp; Coimbatore only</p>
          <h1 className="mt-3 max-w-xl text-[2.6rem] leading-[0.95] sm:text-6xl">
            A greener home,
            <br />
            one sensible
            <br />
            <span className="text-accent dark:text-accent-light">step at a time.</span>
          </h1>
          <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-pine-600 dark:text-mint-200/85">
            Tell us about your home and budget. We rank upgrades by payback, carbon saved and what you can actually
            afford — then show what it does to your electricity and water use.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={href('/new')} className="btn-primary">
              Build my plan
            </a>
            <a href={href('/impact')} className="btn-quiet">
              See the impact
            </a>
          </div>
        </div>

        <div className="border-t-2 border-accent pt-5 md:border-l-[3px] md:border-t-0 md:pl-8 md:pt-0">
          <h2 className="text-lg">Or look at a demo home first</h2>
          <p className="mt-1 text-sm text-pine-500 dark:text-mint-200/75">
            No login. These two profiles use invented figures.
          </p>

          {!config && !error ? (
            <div role="status" className="mt-4 space-y-3">
              <div className="h-11 animate-pulse bg-pine-800/10 dark:bg-mint-100/10" />
              <div className="h-11 animate-pulse bg-pine-800/10 dark:bg-mint-100/10" />
              <span className="sr-only">Loading demo households</span>
            </div>
          ) : null}

          {error ? (
            <Notice tone="error" className="mt-4" title="Demo homes are unavailable">
              {error} You can still build your own plan from scratch.
            </Notice>
          ) : null}

          <ul className="mt-3 divide-y divide-pine-800/10 dark:divide-mint-200/15">
            {config?.demo_households.map((demo) => (
              <li key={demo.id}>
                <button
                  type="button"
                  onClick={() => startDemo(demo.id)}
                  className="group flex w-full items-center justify-between gap-4 py-3.5 text-left"
                >
                  <span>
                    <span className="block font-display text-[1.05rem] leading-tight group-hover:text-accent dark:group-hover:text-accent-light">
                      {demo.label}
                    </span>
                    <span className="mt-0.5 block text-xs uppercase tracking-[0.12em] text-pine-500 dark:text-mint-200/60">
                      Demo · {demo.ownership} · invented figures
                    </span>
                  </span>
                  <span aria-hidden="true" className="font-display text-xl text-accent dark:text-accent-light">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-8 py-12 sm:grid-cols-3">
        {[
          {
            n: '01',
            title: 'A ranked plan',
            body: 'Every upgrade gets a score, a tag and a plain reason it sits where it does. Tick items to watch the budget fill.',
          },
          {
            n: '02',
            title: 'Money and carbon',
            body: 'Cost, yearly saving, payback and CO₂ avoided, using the Tamil Nadu slabs and grid factor in the open assumptions file.',
          },
          {
            n: '03',
            title: 'Water too',
            body: 'Rainwater, greywater, aerators and leaks are ranked alongside electricity upgrades, not as an afterthought.',
          },
        ].map((item) => (
          <div key={item.n} className="border-t hairline pt-4">
            <p className="font-display text-xs text-accent dark:text-accent-light">{item.n}</p>
            <h3 className="mt-1 text-lg">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-pine-500 dark:text-mint-200/75">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="border-y hairline py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg">What this tool does not know yet</h2>
          <UnverifiedBadge />
        </div>
        <div className="mt-4 grid gap-4 text-sm leading-relaxed text-pine-600 dark:text-mint-200/80 sm:grid-cols-3">
          <p>
            The Tamil Nadu domestic slabs come from an unofficial summary and conflict with other sources. Treat savings
            as a sketch until the official TNPDCL order is checked.{' '}
            <a className="link" href={href('/assumptions')}>
              See every assumption
            </a>
            .
          </p>
          <p>
            The usage model is trained on synthetic households only. Its R² and MAE say nothing about real-world
            accuracy.{' '}
            <a className="link" href={href('/responsible-ai')}>
              How we use AI
            </a>
            .
          </p>
          <p>Only Chennai and Coimbatore are supported. Roof access and ownership change what is even possible.</p>
        </div>
      </section>

      <section className="grid gap-6 py-12 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h2 className="text-2xl sm:text-3xl">Start with your own numbers</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-pine-500 dark:text-mint-200/75">
            About two minutes. Pick your city, note your appliances and recent bill, and set the budget you would
            actually spend this year.
          </p>
        </div>
        <a href={href('/new')} className="btn-primary justify-self-start md:justify-self-end">
          Build my plan
        </a>
      </section>
    </div>
  );
}
