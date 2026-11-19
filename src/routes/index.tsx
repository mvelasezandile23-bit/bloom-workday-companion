import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck2, Clock, Mail, MessageSquareHeart, Sparkles, Target } from "lucide-react";
import { useEffect, useState } from "react";

import { AiDisclaimer } from "@/components/app/ai-disclaimer";
import { QuadrantBadge } from "@/components/app/quadrant-badge";
import { Button } from "@/components/ui/button";
import { fmtHours, formatDue, prioritise } from "@/lib/ai/planner";
import { EMPTY_STATS, useLocalStorage, type Activity, type Stats } from "@/lib/storage";
import { useTasks } from "@/lib/tasks";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — AI Workplace Productivity Assistant" },
      { name: "description", content: "Your workday at a glance: top priorities, recent drafts and quick access to email, planning and chat tools." },
      { property: "og:title", content: "Dashboard — AI Workplace Productivity Assistant" },
      { property: "og:description", content: "Your workday at a glance: top priorities, recent drafts and quick access to email, planning and chat tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const TOOLS = [
  {
    to: "/email" as const,
    icon: Mail,
    title: "Smart Email Generator",
    text: "Turn a one-line instruction into a polished email in a formal, friendly or persuasive tone.",
    cta: "Write an email",
  },
  {
    to: "/planner" as const,
    icon: CalendarCheck2,
    title: "AI Task Planner",
    text: "Paste your to-dos and get them ranked, with suggested deadlines and a daily and weekly plan.",
    cta: "Plan my day",
  },
  {
    to: "/chat" as const,
    icon: MessageSquareHeart,
    title: "Workplace Chat",
    text: "Get practical advice on meetings, feedback, deadlines, salary talks, conflict and more.",
    cta: "Ask a question",
  },
];

const ACTIVITY_ICON = { email: Mail, plan: CalendarCheck2, chat: MessageSquareHeart };

function useGreeting() {
  const [greeting, setGreeting] = useState("Welcome back");
  const [today, setToday] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
    setToday(new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }));
  }, []);
  return { greeting, today };
}

function timeAgo(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Dashboard() {
  const { greeting, today } = useGreeting();
  const [tasks] = useTasks();
  const [stats] = useLocalStorage<Stats>("stats", EMPTY_STATS);
  const [activity] = useLocalStorage<Activity[]>("activity", []);

  const open = prioritise(tasks);
  const top = open.slice(0, 4);
  const doneCount = tasks.filter((t) => t.done).length;
  const openHours = open.reduce((s, t) => s + t.hours, 0);
  const progress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const statCards = [
    { label: "Emails drafted", value: stats.emails, icon: Mail },
    { label: "Plans created", value: stats.plans, icon: CalendarCheck2 },
    { label: "Questions asked", value: stats.chats, icon: MessageSquareHeart },
    { label: "Open work", value: open.length ? fmtHours(openHours) : "0h", icon: Clock },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated sm:p-10">
        <div className="dot-pattern absolute inset-0 opacity-60" aria-hidden />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="text-sm font-medium opacity-90">{today || "\u00a0"}</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{greeting} 👋</h1>
            <p className="mt-3 max-w-xl text-base opacity-95 sm:text-lg">
              Your assistant for clearer emails, calmer days and better decisions at work.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="onHero" size="lg">
                <Link to="/planner">
                  <Target /> Plan today
                </Link>
              </Button>
              <Button asChild size="lg" className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25">
                <Link to="/email">
                  <Mail /> Draft an email
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-primary-foreground/15 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Task progress</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-primary-foreground/25">
              <div className="h-full rounded-full bg-primary-foreground transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm opacity-90">
              {tasks.length
                ? `${doneCount} of ${tasks.length} tasks done · ${open.length} still open`
                : "Add your tasks in the planner to track your progress here."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="surface-card p-4 sm:p-5">
            <span className="grid size-9 place-items-center rounded-xl bg-secondary text-primary">
              <s.icon className="size-4.5" />
            </span>
            <p className="mt-3 font-display text-2xl font-semibold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Your tools</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {TOOLS.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="surface-card group flex flex-col p-6 transition-shadow hover:shadow-elevated"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
                <t.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{t.title}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {t.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Top priorities</h2>
              <p className="text-xs text-muted-foreground">Ranked by urgency and importance</p>
            </div>
            <Button asChild variant="soft" size="sm">
              <Link to="/planner">Open planner</Link>
            </Button>
          </div>
          {top.length ? (
            <ul className="space-y-2.5">
              {top.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      ~{fmtHours(t.hours)} · due {formatDue(t.suggestedDeadline)}
                    </p>
                  </div>
                  <QuadrantBadge quadrant={t.quadrant} className="hidden sm:inline-flex" />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Target}
              text="No open tasks yet. Add a few in the planner and your priorities will show up here."
              to="/planner"
              cta="Add tasks"
            />
          )}
        </div>

        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
          <p className="mb-4 text-xs text-muted-foreground">Saved on this device only</p>
          {activity.length ? (
            <ul className="space-y-3">
              {activity.slice(0, 6).map((a) => {
                const Icon = ACTIVITY_ICON[a.type];
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{timeAgo(a.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Sparkles} text="Your drafted emails, plans and chats will appear here." to="/chat" cta="Start a chat" />
          )}
        </div>
      </section>

      <AiDisclaimer />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  to,
  cta,
}: {
  icon: typeof Target;
  text: string;
  to: "/planner" | "/chat";
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center">
      <Icon className="size-6 text-primary" />
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{text}</p>
      <Button asChild variant="soft" size="sm" className="mt-4">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}
