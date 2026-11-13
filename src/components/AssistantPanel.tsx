import { useState } from 'react';
import { ApiError, request } from '../lib/api';
import type { AssistantResponse } from '../lib/types';
import { FieldError, Notice } from './ui';

type Message = { role: 'user' | 'assistant'; text: string };

const quickQuestions = [
  'What should I do first?',
  'Why is rooftop solar not in my plan?',
  'How much water can I save?',
];

export function AssistantPanel({ householdId, token }: { householdId: string; token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<'en' | 'ta' | 'hi'>('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [usedFallback, setUsedFallback] = useState(false);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text) {
      setFieldError('Type a question first.');
      return;
    }
    setFieldError(undefined);
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const res = await request<AssistantResponse>('/assistant', {
        method: 'POST',
        token,
        body: { household_id: householdId, message: text, language },
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      setUsedFallback(!res.used_model);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The assistant did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="assistant-title" className="border-t-2 border-accent/50 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="assistant-title" className="text-xl">
          Ask about this plan
        </h2>
        <label className="text-xs text-pine-500 dark:text-mint-200/70">
          <span className="mr-2">Answer language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'ta' | 'hi')}
            className="border border-pine-800/20 bg-transparent px-2 py-1 text-xs dark:border-mint-200/25"
          >
            <option value="en">English</option>
            <option value="ta">தமிழ்</option>
            <option value="hi">हिन्दी</option>
          </select>
        </label>
      </div>
      <p className="mt-1 text-xs text-pine-500 dark:text-mint-200/65">
        Answers are drawn only from your saved plan. No login, no chat history leaves this plan.
      </p>

      {messages.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {messages.map((message, index) => (
            <li
              key={index}
              className={
                message.role === 'user'
                  ? 'border-l-2 border-pine-800/25 pl-3 text-sm'
                  : 'border-l-2 border-accent bg-accent/5 py-2 pl-3 pr-2 text-sm leading-relaxed whitespace-pre-line dark:bg-accent/10'
              }
            >
              <span className="label mb-1 block">{message.role === 'user' ? 'You' : 'Planner'}</span>
              {message.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-pine-500 dark:text-mint-200/70">
          Nothing asked yet. Pick one to start.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {quickQuestions.map((question) => (
          <button key={question} type="button" className="btn-quiet text-xs" onClick={() => ask(question)} disabled={busy}>
            {question}
          </button>
        ))}
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label className="label" htmlFor="assistant-input">
          Your question
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder="e.g. What does the BLDC fan upgrade change?"
            className={`field mt-0 flex-1 ${fieldError ? 'field-invalid' : ''}`}
            aria-invalid={Boolean(fieldError)}
          />
          <button type="submit" className="btn-primary sm:w-auto" disabled={busy}>
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        <FieldError message={fieldError} />
      </form>

      {error ? (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      ) : null}

      {usedFallback && !busy ? (
        <Notice tone="synthetic" className="mt-3">
          No language model is configured on this deployment, so this reply was assembled directly from your plan
          numbers. Estimates only, not advice.
        </Notice>
      ) : null}
    </section>
  );
}
