import { HttpError } from "./http.ts";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-4-5";
const TIMEOUT_MS = 25000;
const RETRIES = 2;

type Content =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

export function claudeConfigured(): boolean {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}

export async function callClaude(
  system: string,
  content: Content[],
  maxTokens = 600,
): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status >= 500 || res.status === 429) throw new Error(`Claude returned ${res.status}`);
      if (!res.ok) throw new Error(`Claude request failed with ${res.status}`);
      const body = await res.json();
      const text = body?.content?.find((b: { type: string }) => b.type === "text")?.text;
      if (typeof text !== "string") throw new Error("Claude returned no text");
      return text;
    } catch (err) {
      lastError = err;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

const BILL_FIELDS_PROMPT = `You read an Indian electricity bill. Return ONLY a JSON object with these keys:
"billing_period" (YYYY-MM of the billing month, or null), "units" (total units consumed this period, integer, or null),
"tariff_slab" (short text of the slab or tariff category shown, or null), "amount_inr" (total payable in rupees, number or null),
"confidence" (number 0 to 1 for how sure you are of units).
Do not write names, addresses, consumer numbers, meter numbers or phone numbers anywhere in your reply.
If a value is unreadable, use null.`;

export type ExtractedBill = {
  billing_period: string | null;
  units: number | null;
  tariff_slab: string | null;
  amount_inr: number | null;
  confidence: number | null;
};

export async function extractBill(base64: string, mime: string): Promise<ExtractedBill | null> {
  const block: Content = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mime, data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: base64 } };
  const raw = await callClaude(BILL_FIELDS_PROMPT, [block, { type: "text", text: "Extract the fields." }], 300);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]);
  return {
    billing_period: typeof parsed.billing_period === "string" && /^\d{4}-\d{2}$/.test(parsed.billing_period)
      ? parsed.billing_period
      : null,
    units: Number.isInteger(parsed.units) && parsed.units >= 0 ? parsed.units : null,
    tariff_slab: typeof parsed.tariff_slab === "string" ? parsed.tariff_slab.slice(0, 60) : null,
    amount_inr: typeof parsed.amount_inr === "number" && parsed.amount_inr >= 0 ? parsed.amount_inr : null,
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : null,
  };
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
};

export function assistantSystemPrompt(language: string, planJson: string): string {
  return `You are the Green Home Planners assistant. Reply in ${LANGUAGE_NAMES[language]}.
Answer only from the plan data below. Quote numbers exactly as given. If a number is not in the data, say you do not have it.
Say that all figures are planning estimates, not guarantees or quotes. Keep answers under 120 words.
Plan data (JSON):
${planJson}`;
}

export function assertLanguage(language: unknown): "en" | "ta" | "hi" {
  if (language === "en" || language === "ta" || language === "hi") return language;
  throw new HttpError(422, "validation_failed", "Choose English, Tamil or Hindi.", "language");
}
