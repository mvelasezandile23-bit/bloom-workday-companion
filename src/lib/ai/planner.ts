import { addDays, findDatePhrase, fromISODate, resolveDate, toISODate, capitalize } from "./text";

export type Level = 1 | 2 | 3;
export type Quadrant = "do" | "schedule" | "delegate" | "later";

export interface Task {
  id: string;
  title: string;
  urgency: Level;
  importance: Level;
  hours: number;
  due: string | null;
  done: boolean;
  createdAt: number;
}

export interface AnalysedTask extends Task {
  score: number;
  quadrant: Quadrant;
  suggestedDeadline: string;
  daysLeft: number | null;
  reason: string;
}

export const QUADRANT_LABELS: Record<Quadrant, string> = {
  do: "Do first",
  schedule: "Schedule",
  delegate: "Delegate",
  later: "Do later",
};

export const LEVEL_LABELS: Record<Level, string> = { 1: "Low", 2: "Medium", 3: "High" };

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export function addWorkingDays(d: Date, n: number) {
  let r = startOfDay(d);
  let left = n;
  while (left > 0) {
    r = addDays(r, 1);
    if (r.getDay() !== 0 && r.getDay() !== 6) left--;
  }
  return r;
}

export function analyseTask(task: Task, now = new Date()): AnalysedTask {
  const daysLeft = task.due ? daysBetween(now, fromISODate(task.due)) : null;
  const urgent = task.urgency === 3 || (daysLeft !== null && daysLeft <= 1);
  const important = task.importance >= 2;
  const quadrant: Quadrant = urgent && important ? "do" : important ? "schedule" : urgent ? "delegate" : "later";

  let dueBoost = 0;
  if (daysLeft !== null) {
    if (daysLeft < 0) dueBoost = 6;
    else if (daysLeft === 0) dueBoost = 5;
    else if (daysLeft === 1) dueBoost = 4;
    else if (daysLeft <= 3) dueBoost = 2.5;
    else if (daysLeft <= 7) dueBoost = 1;
  }
  const quickWin = task.hours <= 0.5 ? 0.5 : 0;
  const score = Math.round((task.urgency * 3 + task.importance * 3.5 + dueBoost + quickWin) * 10) / 10;

  let suggested: Date;
  if (task.due) suggested = fromISODate(task.due);
  else if (quadrant === "do") suggested = startOfDay(now);
  else if (quadrant === "delegate") suggested = addWorkingDays(now, 1);
  else if (quadrant === "schedule") suggested = addWorkingDays(now, task.importance === 3 ? 2 : 3);
  else suggested = addWorkingDays(now, 5);

  const when = formatDue(toISODate(suggested), now);
  const reasons: Record<Quadrant, string> = {
    do: daysLeft !== null && daysLeft < 0
      ? "Overdue and important — finish this first, then update anyone waiting on it."
      : `Urgent and important — tackle this first, ideally in your morning focus block (${when}).`,
    schedule: `Important but not urgent — protect focused time for it before ${when}.`,
    delegate: `Time-sensitive but lower impact — delegate it or batch it quickly by ${when}.`,
    later: `Low urgency and impact — pencil it in for ${when}, or drop it if priorities change.`,
  };

  return { ...task, score, quadrant, suggestedDeadline: toISODate(suggested), daysLeft, reason: reasons[quadrant] };
}

export function prioritise(tasks: Task[], now = new Date()): AnalysedTask[] {
  return tasks
    .filter((t) => !t.done)
    .map((t) => analyseTask(t, now))
    .sort((a, b) => b.score - a.score || (a.suggestedDeadline < b.suggestedDeadline ? -1 : 1) || a.hours - b.hours);
}

export function formatDue(iso: string, now = new Date()) {
  const d = fromISODate(iso);
  const diff = daysBetween(now, d);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff < 0) return `${-diff} days ago`;
  if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/* ---------- Smart task parsing ---------- */

const URGENT = /\b(urgent|asap|immediately|critical|overdue|tonight|eod|right away|today)\b|!/i;
const NOT_URGENT = /\b(someday|whenever|no rush|eventually|low priority|nice to have|maybe|when possible)\b/i;
const IMPORTANT =
  /\b(client|customer|ceo|boss|manager|board|deadline|important|critical|report|presentation|budget|proposal|contract|launch|review|exam|payroll|investor|audit|tender|interview|strategy)\b/i;
const UNIMPORTANT =
  /\b(tidy|clean|declutter|social media|browse|optional|nice to have|newsletter|filing|organi[sz]e (?:my )?(?:desk|inbox|files)|coffee)\b/i;

function estimateHours(text: string): number {
  const h = text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (h) return Math.min(12, Math.max(0.25, Number(h[1])));
  const m = text.match(/(\d+)\s*(?:m|min|mins|minutes)\b/i);
  if (m) return Math.max(0.25, Math.round((Number(m[1]) / 60) * 4) / 4);
  if (/\b(email|reply|call|check|confirm|book|send|pay|sign)\b/i.test(text)) return 0.5;
  if (/\b(meeting|sync|stand-?up|1:1|interview)\b/i.test(text)) return 1;
  if (/\b(report|presentation|proposal|plan|analysis|design|develop|build|write|research|strategy|budget)\b/i.test(text)) return 2;
  return 1;
}

function cleanTitle(text: string, datePhrase: string | null) {
  let t = text;
  if (datePhrase) t = t.replace(new RegExp(`\\b(?:due|by|on|before)?\\s*${datePhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "");
  t = t
    .replace(/\(?\s*\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|m|min|mins|minutes)\b\s*\)?/gi, "")
    .replace(/\b(urgent|asap|high priority|low priority|important|critical|no rush|nice to have)\b/gi, "")
    .replace(/!+/g, "")
    .replace(/\s*[-–|,;:()]+\s*$/g, "")
    .replace(/^\s*[-–*•\d.)\s]+/, "")
    .replace(/\s*[-–|,;:]\s*[-–|,;:\s]*/g, (m) => (m.includes(",") ? ", " : " – "))
    .replace(/\s+/g, " ")
    .replace(/[\s–,]+$/g, "")
    .trim();
  return capitalize(t);
}

export function parseTaskLine(line: string, now = new Date()): Omit<Task, "id" | "createdAt" | "done"> | null {
  const text = line.trim();
  if (!text) return null;
  const datePhrase = findDatePhrase(text);
  const dueDate = datePhrase ? resolveDate(datePhrase, now) : null;
  const daysLeft = dueDate ? daysBetween(now, dueDate) : null;

  let urgency: Level = 2;
  if (URGENT.test(text) || (daysLeft !== null && daysLeft <= 1)) urgency = 3;
  else if (NOT_URGENT.test(text) || (daysLeft !== null && daysLeft > 7)) urgency = 1;

  let importance: Level = 2;
  if (/\bhigh priority\b/i.test(text) || IMPORTANT.test(text)) importance = 3;
  else if (/\blow priority\b/i.test(text) || UNIMPORTANT.test(text)) importance = 1;

  const title = cleanTitle(text, datePhrase) || capitalize(text);
  return { title, urgency, importance, hours: estimateHours(text), due: dueDate ? toISODate(dueDate) : null };
}

/* ---------- Scheduling ---------- */

export interface ScheduleOptions {
  start: string; // "09:00"
  end: string; // "17:00"
}

export interface DayBlock {
  start: string;
  end: string;
  kind: "task" | "break" | "lunch";
  title: string;
  taskId?: string;
  quadrant?: Quadrant;
  continued?: boolean;
}

export function toMinutes(hhmm: string) {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const FOCUS_LIMIT = 90;
const BREAK = 15;
const LUNCH_START = toMinutes("12:30");
const LUNCH = 60;

export function buildDailySchedule(tasks: Task[], opts: ScheduleOptions, now = new Date()) {
  const ordered = prioritise(tasks, now);
  const dayStart = toMinutes(opts.start);
  const dayEnd = toMinutes(opts.end);
  const hasLunch = LUNCH_START > dayStart && LUNCH_START + LUNCH < dayEnd;
  const blocks: DayBlock[] = [];
  const overflow: { task: AnalysedTask; hours: number }[] = [];

  let cursor = dayStart;
  let focus = 0;
  let lunchTaken = !hasLunch;

  for (const task of ordered) {
    let remaining = Math.round((task.hours * 60) / 15) * 15 || 15;
    let first = true;
    while (remaining > 0 && cursor < dayEnd) {
      if (!lunchTaken && cursor >= LUNCH_START) {
        blocks.push({ start: fromMinutes(cursor), end: fromMinutes(cursor + LUNCH), kind: "lunch", title: "Lunch & recharge" });
        cursor += LUNCH;
        focus = 0;
        lunchTaken = true;
        continue;
      }
      if (focus >= FOCUS_LIMIT && !lunchTaken && LUNCH_START - cursor <= 30) {
        // Lunch is close: keep working until lunch instead of taking a separate short break.
        focus = FOCUS_LIMIT - (LUNCH_START - cursor);
        continue;
      }
      if (focus >= FOCUS_LIMIT) {
        const end = Math.min(cursor + BREAK, dayEnd);
        blocks.push({ start: fromMinutes(cursor), end: fromMinutes(end), kind: "break", title: "Short break" });
        cursor = end;
        focus = 0;
        continue;
      }
      const limit = !lunchTaken ? Math.min(LUNCH_START, dayEnd) : dayEnd;
      const available = Math.min(limit - cursor, FOCUS_LIMIT - focus);
      if (available <= 0) {
        if (!lunchTaken) cursor = LUNCH_START;
        else break;
        continue;
      }
      const chunk = Math.min(remaining, available);
      blocks.push({
        start: fromMinutes(cursor),
        end: fromMinutes(cursor + chunk),
        kind: "task",
        title: task.title,
        taskId: task.id,
        quadrant: task.quadrant,
        continued: !first,
      });
      first = false;
      cursor += chunk;
      focus += chunk;
      remaining -= chunk;
    }
    if (remaining > 0) overflow.push({ task, hours: remaining / 60 });
  }

  const plannedHours = blocks.filter((b) => b.kind === "task").reduce((s, b) => s + (toMinutes(b.end) - toMinutes(b.start)) / 60, 0);
  return { blocks, overflow, plannedHours };
}

export interface WeekDay {
  date: string;
  label: string;
  items: { task: AnalysedTask; hours: number }[];
  load: number;
  capacity: number;
}

export function workWeek(now = new Date()) {
  let d = startOfDay(now);
  while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
  const days: Date[] = [];
  while (days.length < 5) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

export function buildWeeklyPlan(tasks: Task[], opts: ScheduleOptions, now = new Date()) {
  const ordered = prioritise(tasks, now);
  const capacity = Math.max(1, (toMinutes(opts.end) - toMinutes(opts.start)) / 60 - 1);
  const days: WeekDay[] = workWeek(now).map((d) => ({
    date: toISODate(d),
    label: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    items: [],
    load: 0,
    capacity,
  }));
  const atRisk: AnalysedTask[] = [];
  const unscheduled: { task: AnalysedTask; hours: number }[] = [];

  for (const task of ordered) {
    let remaining = task.hours;
    let lastDay: string | null = null;
    for (const day of days) {
      if (remaining <= 0) break;
      const free = day.capacity - day.load;
      if (free <= 0.01) continue;
      const h = Math.min(free, remaining);
      day.items.push({ task, hours: h });
      day.load += h;
      remaining -= h;
      lastDay = day.date;
    }
    if (remaining > 0.01) unscheduled.push({ task, hours: remaining });
    if ((lastDay && lastDay > task.suggestedDeadline) || remaining > 0.01) atRisk.push(task);
  }
  return { days, atRisk, unscheduled, capacity };
}

/* ---------- Insights ---------- */

export function planInsights(tasks: Task[], opts: ScheduleOptions, now = new Date()): string[] {
  const ordered = prioritise(tasks, now);
  if (!ordered.length) return [];
  const daily = buildDailySchedule(tasks, opts, now);
  const weekly = buildWeeklyPlan(tasks, opts, now);
  const total = ordered.reduce((s, t) => s + t.hours, 0);
  const weekCap = weekly.capacity * weekly.days.length;
  const out: string[] = [];

  const first = daily.blocks.find((b) => b.kind === "task");
  out.push(
    `You have ${ordered.length} open task${ordered.length === 1 ? "" : "s"} totalling ${fmtHours(total)}. ${
      first ? `Start with “${first.title}” at ${first.start} while your energy is highest.` : ""
    }`.trim(),
  );

  const doFirst = ordered.filter((t) => t.quadrant === "do");
  if (doFirst.length > 3)
    out.push(`${doFirst.length} tasks are marked “Do first” — that's a heavy day. Consider renegotiating one deadline or asking for support.`);

  const load = Math.round((total / weekCap) * 100);
  if (total > weekCap)
    out.push(`Your week is over capacity (${load}% of ${fmtHours(weekCap)}). Move or delegate about ${fmtHours(total - weekCap)} of work.`);
  else out.push(`This week is at ${load}% capacity, leaving ${fmtHours(weekCap - total)} free for meetings and surprises.`);

  const delegate = ordered.filter((t) => t.quadrant === "delegate");
  if (delegate.length) out.push(`Consider delegating ${listTitles(delegate)} — urgent, but not the best use of your expertise.`);

  for (const t of weekly.atRisk.slice(0, 2))
    out.push(`“${t.title}” may miss its ${t.due ? "deadline" : "suggested deadline"} (${formatDue(t.suggestedDeadline, now)}). Start earlier or request an extension.`);

  const big = ordered.filter((t) => t.hours >= 3);
  if (big.length) out.push(`Break ${listTitles(big)} into smaller milestones so progress is visible each day.`);

  const quick = ordered.filter((t) => t.hours <= 0.5);
  if (quick.length >= 2) out.push(`Batch your quick wins (${listTitles(quick)}) into one block to avoid constant context-switching.`);

  if (daily.overflow.length)
    out.push(`${daily.overflow.length} task${daily.overflow.length === 1 ? " doesn't" : "s don't"} fit today and will roll into tomorrow's plan.`);

  return out;
}

function listTitles(ts: AnalysedTask[]) {
  const names = ts.slice(0, 3).map((t) => `“${t.title}”`);
  if (ts.length > 3) names.push(`${ts.length - 3} more`);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
}

export function fmtHours(h: number) {
  const r = Math.round(h * 4) / 4;
  if (r < 1) return `${Math.round(r * 60)} min`;
  return `${r % 1 === 0 ? r : r.toFixed(2).replace(/0$/, "")}h`;
}

export function scheduleAsText(tasks: Task[], opts: ScheduleOptions, now = new Date()) {
  const daily = buildDailySchedule(tasks, opts, now);
  const weekly = buildWeeklyPlan(tasks, opts, now);
  const lines = [`DAILY PLAN — ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`];
  for (const b of daily.blocks) lines.push(`${b.start}–${b.end}  ${b.title}${b.continued ? " (continued)" : ""}`);
  if (daily.overflow.length) lines.push(`Carry over: ${daily.overflow.map((o) => o.task.title).join(", ")}`);
  lines.push("", "WEEKLY PLAN");
  for (const d of weekly.days) {
    lines.push(`${d.label} (${fmtHours(d.load)})`);
    for (const i of d.items) lines.push(`  • ${i.task.title} — ${fmtHours(i.hours)}`);
    if (!d.items.length) lines.push("  • Free for deep work or meetings");
  }
  const insights = planInsights(tasks, opts, now);
  if (insights.length) lines.push("", "INSIGHTS", ...insights.map((i) => `• ${i}`));
  return lines.join("\n");
}
