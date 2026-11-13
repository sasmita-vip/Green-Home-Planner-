import { href } from '../lib/router';

const sections = [
  {
    title: 'The tariff is not confirmed',
    body: 'The Tamil Nadu domestic slab table came from an unofficial secondary summary. It disagrees with other published slab tables, so every rupee saving is labelled unverified and the plan page shows a warning until the official TNPDCL tariff order is checked line by line.',
  },
  {
    title: 'The usage model is trained on synthetic data',
    body: 'The usage predictor learned from 4,000 generated households, not real ones. Its reported R² of 0.997 and MAE of about 19.5 kWh per month describe how well it reproduces its own generator. They are not real-world accuracy, and we never present them as such. The prediction screen labels the output synthetic.',
  },
  {
    title: 'Bill images cannot be redacted',
    body: 'When bill reading is enabled, the whole image or PDF is sent to the language model. We cannot black out your name, address, consumer number or meter number before it leaves, so do not upload a bill you are not comfortable sending. Cropping the image yourself is the only way to hide those details. If the model is not configured, the screen falls back to typing the numbers in by hand.',
  },
  {
    title: 'Estimates, not quotes or guarantees',
    body: 'Costs, subsidies, solar yield and water value are placeholders. A payback year is arithmetic, not a promise. Before spending money, get an installer quote and check your own bills.',
  },
  {
    title: 'Two cities only',
    body: 'Chennai and Coimbatore. Tariffs, rainfall and irradiance differ elsewhere, and the assumptions do not cover other states or cities.',
  },
  {
    title: 'What is stored, and what is not',
    body: 'There are no accounts. This browser generates a random token, sends it with each request, and the server keeps only its SHA-256 hash. Households, plans, bills and assistant messages are tied to that hash. Clear the browser token and the plan is unreachable — that is the trade-off for having no login. The server never stores bill images.',
  },
  {
    title: 'What the assistant does',
    body: 'The assistant is grounded in the saved plan JSON for that household: it is told to quote those numbers and to say when a number is missing. With no model key configured, replies are assembled from the plan figures by rule instead, and the panel says so.',
  },
];

export function ResponsibleAI() {
  return (
    <div className="max-w-3xl py-6">
      <header>
        <p className="label">Responsible AI</p>
        <h1 className="mt-2 text-[2rem] leading-tight sm:text-[2.6rem]">What this tool knows, and what it does not</h1>
        <p className="mt-3 text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">
          Green Home Planners gives rough, explainable guidance for home upgrades. It is not an energy audit, a
          financial adviser or a quote.
        </p>
      </header>

      <div className="mt-8 space-y-0">
        {sections.map((section, index) => (
          <section key={section.title} className="grid gap-2 border-t hairline py-6 md:grid-cols-[3rem_1fr] md:gap-5">
            <p className="font-display text-sm text-accent dark:text-accent-light">{String(index + 1).padStart(2, '0')}</p>
            <div>
              <h2 className="text-lg">{section.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">{section.body}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="border-t hairline py-6">
        <h2 className="text-lg">Where to check us</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-pine-600 dark:text-mint-200/80">
          Every number is listed with its source and last-checked date on the{' '}
          <a className="link" href={href('/assumptions')}>
            assumptions page
          </a>
          . If a figure disagrees with the official order, the official order wins.
        </p>
      </section>
    </div>
  );
}
