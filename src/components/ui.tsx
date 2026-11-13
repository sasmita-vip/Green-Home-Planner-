import type { ReactNode } from 'react';

export function UnverifiedBadge({ label = 'Unverified' }: { label?: string }) {
  return (
    <span className="tag border-marigold-dark/40 bg-marigold/15 text-marigold-dark dark:border-marigold/50 dark:bg-marigold/10 dark:text-marigold-light">
      {label}
    </span>
  );
}

const toneClasses = {
  warn: 'border-l-marigold bg-marigold/10 text-pine-800 dark:text-mint-100',
  info: 'border-l-accent bg-accent/5 text-pine-800 dark:text-mint-100',
  error: 'border-l-clay bg-clay/10 text-pine-800 dark:text-mint-100',
  synthetic: 'border-l-pine-500 bg-pine-500/10 text-pine-800 dark:text-mint-100',
};

export function Notice({
  tone = 'warn',
  title,
  children,
  className = '',
}: {
  tone?: keyof typeof toneClasses;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-l-[3px] px-4 py-3 text-sm leading-relaxed ${toneClasses[tone]} ${className}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      {children}
    </div>
  );
}

export function StateBlock({
  kind,
  title,
  body,
  action,
}: {
  kind: 'loading' | 'error' | 'empty';
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  if (kind === 'loading') {
    return (
      <div role="status" aria-live="polite" className="space-y-3 py-6">
        <span className="sr-only">{title}</span>
        <div className="h-3 w-2/3 animate-pulse bg-pine-800/10 dark:bg-mint-100/10" />
        <div className="h-3 w-1/2 animate-pulse bg-pine-800/10 dark:bg-mint-100/10" />
        <div className="h-3 w-5/6 animate-pulse bg-pine-800/10 dark:bg-mint-100/10" />
        <p className="pt-2 text-xs text-pine-500 dark:text-mint-200/70">{title}</p>
      </div>
    );
  }
  return (
    <div
      role={kind === 'error' ? 'alert' : undefined}
      className={`border-t-2 py-8 ${kind === 'error' ? 'border-clay' : 'border-pine-800/20 dark:border-mint-200/25'}`}
    >
      <h3 className="text-xl">{title}</h3>
      {body ? <p className="mt-2 max-w-prose text-sm leading-relaxed text-pine-500 dark:text-mint-200/80">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const pct = Math.max(4, Math.min(100, Math.round(score * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 bg-pine-800/10 dark:bg-mint-100/15" aria-hidden="true">
        <div className="h-full bg-accent dark:bg-accent-light" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-pine-500 dark:text-mint-200/70">{score.toFixed(2)}</span>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="err">
      {message}
    </p>
  );
}

export function SectionTitle({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="label">{eyebrow}</p>
      <h2 className="mt-1 text-2xl sm:text-3xl">{children}</h2>
    </div>
  );
}
