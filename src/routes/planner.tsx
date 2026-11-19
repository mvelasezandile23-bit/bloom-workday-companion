import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck2, CalendarDays, Coffee, Lightbulb, ListPlus, Sparkles, Trash2, Utensils } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AiDisclaimer } from "@/components/app/ai-disclaimer";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { QUADRANT_BAR, QuadrantBadge } from "@/components/app/quadrant-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  buildDailySchedule,
  buildWeeklyPlan,
  fmtHours,
  formatDue,
  LEVEL_LABELS,
  planInsights,
  prioritise,
  scheduleAsText,
  type Level,
  type ScheduleOptions,
  type Task,
} from "@/lib/ai/planner";
import { recordActivity, useLocalStorage } from "@/lib/storage";
import { EXAMPLE_TASKS, tasksFromText, useTasks } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planner")({
  head: () => ({
    meta: [
      { title: "AI Task Planner — AI Workplace Productivity Assistant" },
      { name: "description", content: "Paste your to-do list and get tasks ranked by urgency and importance, with suggested deadlines and daily and weekly schedules." },
      { property: "og:title", content: "AI Task Planner" },
      { property: "og:description", content: "Paste your to-do list and get ranked tasks, suggested deadlines and daily and weekly schedules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlannerPage,
});

const LEVELS: Level[] = [3, 2, 1];

function PlannerPage() {
  const [tasks, setTasks] = useTasks();
  const [hours, setHours] = useLocalStorage<ScheduleOptions>("work-hours", { start: "08:00", end: "17:00" });
  const [draft, setDraft] = useState("");

  const ranked = useMemo(() => prioritise(tasks), [tasks]);
  const daily = useMemo(() => buildDailySchedule(tasks, hours), [tasks, hours]);
  const weekly = useMemo(() => buildWeeklyPlan(tasks, hours), [tasks, hours]);
  const insights = useMemo(() => planInsights(tasks, hours), [tasks, hours]);
  const done = tasks.filter((t) => t.done);

  function add(text: string) {
    const added = tasksFromText(text);
    if (!added.length) {
      toast.error("Add at least one task — one per line.");
      return;
    }
    setTasks((prev) => [...prev, ...added]);
    setDraft("");
    recordActivity("plan", `Planned ${added.length} task${added.length === 1 ? "" : "s"}: ${added.map((t) => t.title).join(", ")}`);
    toast.success(`${added.length} task${added.length === 1 ? "" : "s"} added and prioritised`);
  }

  function update(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const validHours = hours.end > hours.start;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck2}
        title="AI Task Planner"
        description="Write tasks the way you think — “Budget report, urgent, 2h, due Friday”. The planner estimates effort, ranks everything and builds your day and week."
        actions={
          tasks.length > 0 ? (
            <>
              <CopyButton text={scheduleAsText(tasks, hours)} label="Copy plan" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Remove all tasks?")) setTasks([]);
                }}
              >
                <Trash2 /> Clear all
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <div className="space-y-6">
          <div className="surface-card p-5 sm:p-6">
            <SectionTitle step="1" title="Add your tasks" hint="One per line. Mention urgency, time and due dates if you know them." />
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder={"Finish budget report – urgent, 2h, due tomorrow\nReply to supplier emails 30 min\nPrepare client slides, due Friday"}
              className="resize-none rounded-xl"
              aria-label="Tasks, one per line"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) add(draft);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="hero" onClick={() => add(draft)}>
                <Sparkles /> Prioritise tasks
              </Button>
              {tasks.length === 0 && (
                <Button variant="soft" onClick={() => add(EXAMPLE_TASKS.join("\n"))}>
                  <ListPlus /> Try an example week
                </Button>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm">
              <span className="font-semibold text-foreground">Work hours</span>
              <Input
                type="time"
                value={hours.start}
                onChange={(e) => setHours({ ...hours, start: e.target.value || "08:00" })}
                className="h-8 w-28"
                aria-label="Start time"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="time"
                value={hours.end}
                onChange={(e) => setHours({ ...hours, end: e.target.value || "17:00" })}
                className="h-8 w-28"
                aria-label="End time"
              />
              {!validHours && <span className="text-xs text-destructive">End time must be after start time.</span>}
            </div>
          </div>

          <div className="surface-card p-5 sm:p-6">
            <SectionTitle step="2" title={`Prioritised tasks (${ranked.length})`} hint="Adjust anything — the plan updates instantly." />
            {ranked.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                Your ranked tasks will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {ranked.map((t, i) => (
                  <li key={t.id} className="relative overflow-hidden rounded-xl border border-border bg-card p-4 pl-5">
                    <span className={cn("absolute inset-y-0 left-0 w-1.5", QUADRANT_BAR[t.quadrant])} />
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={t.done}
                        onCheckedChange={(v) => update(t.id, { done: v === true })}
                        className="mt-1"
                        aria-label={`Mark ${t.title} as done`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                          <input
                            value={t.title}
                            onChange={(e) => update(t.id, { title: e.target.value })}
                            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none focus:underline"
                            aria-label="Task title"
                          />
                          <QuadrantBadge quadrant={t.quadrant} />
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.reason}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <LevelSelect label="Urgency" value={t.urgency} onChange={(v) => update(t.id, { urgency: v })} />
                          <LevelSelect label="Importance" value={t.importance} onChange={(v) => update(t.id, { importance: v })} />
                          <label className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                            <span className="text-muted-foreground">Hours</span>
                            <input
                              type="number"
                              min={0.25}
                              max={12}
                              step={0.25}
                              value={t.hours}
                              onChange={(e) => update(t.id, { hours: Math.min(12, Math.max(0.25, Number(e.target.value) || 0.25)) })}
                              className="w-12 bg-transparent font-semibold text-foreground outline-none"
                            />
                          </label>
                          <label className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
                            <span className="text-muted-foreground">Due</span>
                            <input
                              type="date"
                              value={t.due ?? ""}
                              onChange={(e) => update(t.id, { due: e.target.value || null })}
                              className="bg-transparent font-semibold text-foreground outline-none"
                            />
                          </label>
                          {!t.due && (
                            <span className="text-muted-foreground">
                              Suggested: <span className="font-semibold text-foreground">{formatDue(t.suggestedDeadline)}</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => remove(t.id)}
                            className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                            aria-label={`Delete ${t.title}`}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <details className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
                <summary className="cursor-pointer font-semibold text-foreground">Completed ({done.length})</summary>
                <ul className="mt-2 space-y-1.5">
                  {done.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-muted-foreground">
                      <Checkbox checked onCheckedChange={() => update(t.id, { done: false })} aria-label={`Reopen ${t.title}`} />
                      <span className="line-through">{t.title}</span>
                      <button type="button" onClick={() => remove(t.id)} className="ml-auto hover:text-destructive" aria-label={`Delete ${t.title}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card p-5 sm:p-6">
            <SectionTitle step="3" title="Your schedule" />
            <Tabs defaultValue="day">
              <TabsList className="mb-4 rounded-xl">
                <TabsTrigger value="day" className="rounded-lg">Today</TabsTrigger>
                <TabsTrigger value="week" className="rounded-lg">This week</TabsTrigger>
              </TabsList>
              <TabsContent value="day">
                {daily.blocks.length === 0 ? (
                  <EmptySchedule />
                ) : (
                  <>
                    <p className="mb-3 text-sm text-muted-foreground">
                      {fmtHours(daily.plannedHours)} of focused work between {hours.start} and {hours.end}, with breaks every 90 minutes.
                    </p>
                    <ol className="space-y-2">
                      {daily.blocks.map((b, i) => (
                        <li
                          key={i}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-3",
                            b.kind === "task" ? "border-border bg-card" : "border-dashed border-border bg-muted/50",
                          )}
                        >
                          <span className="w-24 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                            {b.start}–{b.end}
                          </span>
                          {b.kind === "task" ? (
                            <span className={cn("size-2.5 shrink-0 rounded-full", b.quadrant && QUADRANT_BAR[b.quadrant])} />
                          ) : b.kind === "lunch" ? (
                            <Utensils className="size-4 shrink-0 text-primary" />
                          ) : (
                            <Coffee className="size-4 shrink-0 text-primary" />
                          )}
                          <span className={cn("min-w-0 flex-1 truncate text-sm", b.kind === "task" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {b.title}
                            {b.continued && <span className="font-normal text-muted-foreground"> (continued)</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {daily.overflow.length > 0 && (
                      <p className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning">
                        Moves to tomorrow: {daily.overflow.map((o) => `${o.task.title} (${fmtHours(o.hours)})`).join(", ")}
                      </p>
                    )}
                  </>
                )}
              </TabsContent>
              <TabsContent value="week">
                {ranked.length === 0 ? (
                  <EmptySchedule />
                ) : (
                  <div className="space-y-3">
                    {weekly.days.map((d) => {
                      const pct = Math.min(100, Math.round((d.load / d.capacity) * 100));
                      return (
                        <div key={d.date} className="rounded-xl border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <CalendarDays className="size-4 text-primary" /> {d.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {fmtHours(d.load)} / {fmtHours(d.capacity)}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                          </div>
                          {d.items.length ? (
                            <ul className="mt-2.5 flex flex-wrap gap-1.5">
                              {d.items.map((it) => (
                                <li key={it.task.id} className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-xs">
                                  <span className={cn("size-2 rounded-full", QUADRANT_BAR[it.task.quadrant])} />
                                  <span className="font-medium text-foreground">{it.task.title}</span>
                                  <span className="text-muted-foreground">{fmtHours(it.hours)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">Free for deep work, meetings or catching up.</p>
                          )}
                        </div>
                      );
                    })}
                    {weekly.unscheduled.length > 0 && (
                      <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
                        Doesn't fit this week: {weekly.unscheduled.map((u) => `${u.task.title} (${fmtHours(u.hours)})`).join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {insights.length > 0 && (
            <div className="surface-card bg-gradient-soft p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Planning insights</h2>
              </div>
              <ul className="space-y-2.5">
                {insights.map((s) => (
                  <li key={s} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AiDisclaimer compact />
        </div>
      </div>
    </div>
  );
}

function LevelSelect({ label, value, onChange }: { label: string; value: Level; onChange: (v: Level) => void }) {
  return (
    <label className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as Level)}
        className="cursor-pointer bg-transparent font-semibold text-foreground outline-none"
      >
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptySchedule() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
      Add tasks to see a time-blocked plan with breaks and lunch.
    </div>
  );
}
