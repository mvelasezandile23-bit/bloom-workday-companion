/** Small deterministic helpers that let generated text vary without being random on every render. */

export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(items: readonly T[], seed: number, offset = 0): T {
  return items[(seed + offset * 7919) % items.length] as T;
}

/** Picks `count` distinct items in a seed-dependent order. */
export function pickMany<T>(items: readonly T[], count: number, seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j] as T, arr[i] as T];
  }
  return arr.slice(0, count);
}

export function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function titleCase(s: string) {
  const small = new Set(["a", "an", "and", "the", "of", "for", "to", "in", "on", "by", "with", "at"]);
  return s
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w.toLowerCase()) ? w.toLowerCase() : capitalize(w)))
    .join(" ");
}

export function clean(s: string) {
  return s.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

export function stripEndPunct(s: string) {
  return s.replace(/[\s.!?,;:]+$/g, "").trim();
}

export function ensurePeriod(s: string) {
  const t = s.trim();
  if (!t) return t;
  return /[.!?]$/.test(t) ? t : t + ".";
}

/** Rewrites third-person references to the recipient into second person ("his report" -> "your report"). */
export function toSecondPerson(s: string) {
  return s
    .replace(/\b(he|she|they) (is|are)\b/gi, "you are")
    .replace(/\b(he|she|they) (was|were)\b/gi, "you were")
    .replace(/\b(he|she|they) (has|have)\b/gi, "you have")
    .replace(/\b(he|she|they) (does|do)\b/gi, "you do")
    .replace(/\b(he|she|they)\b/gi, "you")
    .replace(/\b(him|them)\b/gi, "you")
    .replace(/\b(his|their)\b/gi, "your")
    .replace(/\bher\b(?=\s+[a-z])/gi, "your")
    .replace(/\bher\b/gi, "you")
    .replace(/\bhimself|herself|themselves\b/gi, "yourself");
}

export function truncateWords(s: string, max: number) {
  const words = s.split(/\s+/);
  return words.length <= max ? s : words.slice(0, max).join(" ") + "…";
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

/** Finds the first human date phrase, e.g. "by Friday", "tomorrow", "12 March", "end of the month". */
export function findDatePhrase(s: string): string | null {
  const patterns = [
    /\b(?:by|on|before|until|this|next)?\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(?:morning|afternoon|evening))?\b/i,
    /\b(?:by\s+)?(?:today|tomorrow|tonight|next week|this week|end of (?:the )?(?:day|week|month|quarter)|eod|eow)\b/i,
    new RegExp(`\\b(?:by|on|before)?\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS})\\b`, "i"),
    new RegExp(`\\b(?:by|on|before)?\\s*(?:${MONTHS})\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "i"),
    /\b(?:by|on|before)?\s*\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[0].trim();
  }
  return null;
}

export function findTime(s: string): string | null {
  const m = s.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}:\d{2}\b|\b(?:noon|midday)\b/i);
  return m ? m[0] : null;
}

/** Resolves a date phrase to an actual date relative to `now`, where possible. */
export function resolveDate(phrase: string, now = new Date()): Date | null {
  const p = phrase.toLowerCase();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\btoday|tonight|eod|end of (the )?day\b/.test(p)) return base;
  if (/\btomorrow\b/.test(p)) return addDays(base, 1);
  if (/\bnext week\b/.test(p)) return addDays(base, 7);
  if (/\b(this week|end of (the )?week|eow)\b/.test(p)) {
    const diff = (5 - base.getDay() + 7) % 7;
    return addDays(base, diff);
  }
  if (/end of (the )?month/.test(p)) return new Date(base.getFullYear(), base.getMonth() + 1, 0);
  const wd = WEEKDAYS.findIndex((d) => p.includes(d));
  if (wd >= 0) {
    let diff = (wd - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (/\bnext\b/.test(p) && diff < 7) diff += 7;
    return addDays(base, diff);
  }
  const slash = p.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    let year = slash[3] ? Number(slash[3]) : base.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }
  const monthRe = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})|(${MONTHS})\\s+(\\d{1,2})`, "i");
  const mm = p.match(monthRe);
  if (mm) {
    const day = Number(mm[1] ?? mm[4]);
    const mName = (mm[2] ?? mm[3] ?? "").slice(0, 3);
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(mName);
    let d = new Date(base.getFullYear(), month, day);
    if (d < base) d = new Date(base.getFullYear() + 1, month, day);
    return d;
  }
  return null;
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string) {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
