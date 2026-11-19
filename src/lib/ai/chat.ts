import { generateEmail, type Tone } from "./email";
import { GLOSSARY, OFF_TOPIC, TOPICS, type Role, type Topic } from "./knowledge";
import { buildDailySchedule, fmtHours, parseTaskLine, prioritise, QUADRANT_LABELS, type Task } from "./planner";
import { hash, pick, pickMany, stripEndPunct, truncateWords } from "./text";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  topic?: string;
  edited?: boolean;
}

export interface ChatReply {
  content: string;
  topic?: string;
  suggestions: string[];
}

export const STARTER_SUGGESTIONS = [
  "How do I ask my manager for a raise?",
  "Plan my day: client report 2h, team meeting, reply to emails",
  "How do I deal with a difficult colleague?",
  "Write an email to my team about the new project deadline",
  "What is an OKR?",
  "I'm feeling burnt out — what can I do?",
];

function detectRole(text: string): Role | null {
  const t = text.toLowerCase();
  if (/\b(my )?(manager|boss|supervisor|line manager|director|ceo)\b/.test(t)) return "manager";
  if (/\b(client|customer)s?\b/.test(t)) return "client";
  if (/\b(my team|direct reports?|team members?|employees?|my staff|intern)\b/.test(t)) return "report";
  if (/\b(colleague|coworker|co-worker|peer|teammate)s?\b/.test(t)) return "colleague";
  if (/\bhr\b|human resources/.test(t)) return "hr";
  if (/\bteam\b/.test(t)) return "team";
  return null;
}

function scoreTopics(text: string): { topic: Topic; score: number }[] {
  return TOPICS.map((topic) => {
    const matches = text.match(new RegExp(topic.match.source, "gi")) ?? [];
    return { topic, score: matches.reduce((s, m) => s + m.length, 0) };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

function echoPhrase(text: string) {
  const q = stripEndPunct(text)
    .replace(/^(hi|hello|hey)[,!\s]+/i, "")
    .replace(/^(can you |could you |please )?(help me |tell me |advise me )?(with |on |about )?/i, "")
    .replace(/^(how (do|can|should) i|what should i do (if|when|about)|what's the best way to|any tips (on|for))\s+/i, "");
  const t = truncateWords(q, 12);
  return /^I\b/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

function lastAssistantTopic(history: ChatMessage[]): Topic | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m && m.role === "assistant" && m.topic) return TOPICS.find((t) => t.id === m.topic) ?? null;
  }
  return null;
}

function list(items: string[]) {
  return items.map((t, i) => `${i + 1}. ${t}`).join("\n");
}

function topicReply(topic: Topic, text: string, seed: number, history: ChatMessage[]): ChatReply {
  const role = detectRole(text);
  const timesSeen = history.filter((m) => m.role === "assistant" && m.topic === topic.id).length;
  const tips = pickMany(topic.tips, 4, seed + timesSeen);
  const phrase = echoPhrase(text);
  const intro = pick(topic.intros, seed);
  const parts = [
    phrase.split(" ").length >= 3 ? `You asked about **${phrase}**. ${intro}` : intro,
    `**${topic.heading}**\n${list(tips)}`,
  ];
  if (role && topic.byRole?.[role]) parts.push(`💡 ${topic.byRole[role]}`);
  parts.push(pick(topic.closers, seed, 1) + " Or say **“tell me more”** for deeper tips.");
  return { content: parts.join("\n\n"), topic: topic.id, suggestions: topic.suggestions };
}

function moreReply(topic: Topic, history: ChatMessage[], seed: number): ChatReply {
  const lastMsg = [...history].reverse().find((m) => m.role === "assistant" && m.topic === topic.id);
  const unused = topic.tips.filter((t) => !lastMsg?.content.includes(t));
  const extra = [...topic.deeper, ...unused.slice(0, 2)];
  return {
    content: [
      `Here's a deeper look at **${topic.label.toLowerCase()}**:`,
      list(extra),
      pick(topic.closers, seed, 2),
    ].join("\n\n"),
    topic: topic.id,
    suggestions: topic.suggestions,
  };
}

function emailReply(text: string, seed: number): ChatReply {
  const tone: Tone = /\b(friendly|casual|informal|warm)\b/i.test(text)
    ? "friendly"
    : /\b(persuasive|convinc\w*|pitch|sell|win)\b/i.test(text)
      ? "persuasive"
      : "formal";
  const email = generateEmail({ instructions: text, tone, length: "standard", variation: seed % 3 });
  return {
    content: [
      `Here's a ${tone} draft based on your request:`,
      `**Subject:** ${email.subject}`,
      email.body,
      "Want a different tone or length? Open the **Smart Email Generator** to fine-tune it, or ask me to make it friendlier or more persuasive.",
    ].join("\n\n"),
    topic: "communication",
    suggestions: ["Make it more friendly", "Make it more persuasive", "How do I write clearer emails?"],
  };
}

function planReply(text: string): ChatReply | null {
  const body = text.includes(":") ? text.slice(text.indexOf(":") + 1) : text.replace(/^.*?\b(plan my (?:day|week)|prioriti[sz]e|schedule)\b\s*/i, "");
  const lines = body.split(/\n|;|,|\band then\b|\band\b/i).map((s) => s.trim()).filter((s) => s.length > 2);
  if (!lines.length) return null;
  const now = new Date();
  const tasks: Task[] = lines
    .map((l, i) => parseTaskLine(l, now))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t, i) => ({ ...t, id: `c${i}`, done: false, createdAt: i }));
  if (!tasks.length) return null;
  const ranked = prioritise(tasks, now);
  const { blocks, overflow } = buildDailySchedule(tasks, { start: "09:00", end: "17:00" }, now);
  const total = ranked.reduce((s, t) => s + t.hours, 0);
  const rankedText = ranked
    .map((t, i) => `${i + 1}. **${t.title}** — ${QUADRANT_LABELS[t.quadrant]}, ~${fmtHours(t.hours)}`)
    .join("\n");
  const sched = blocks.map((b) => `- ${b.start}–${b.end} · ${b.title}${b.continued ? " (cont.)" : ""}`).join("\n");
  return {
    content: [
      `I've prioritised your ${ranked.length} task${ranked.length === 1 ? "" : "s"} (about ${fmtHours(total)} of work) by urgency and importance:`,
      rankedText,
      `**Suggested schedule for today**\n${sched}`,
      overflow.length ? `⚠️ ${overflow.map((o) => o.task.title).join(", ")} won't fit today — I'd move it to tomorrow morning.` : "This fits comfortably in a standard workday, with breaks included.",
      "For editable task cards and a full weekly view, open the **AI Task Planner**.",
    ].join("\n\n"),
    topic: "priorities",
    suggestions: ["How do I stay focused during deep work?", "How do I say no to extra tasks?", "Plan my week"],
  };
}

function glossaryReply(text: string): ChatReply | null {
  const m = text.toLowerCase().match(/\b(?:what(?:'s| is| are| does)|define|meaning of|explain)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+mean)?\??$/);
  const subject = m?.[1] ?? text.toLowerCase();
  const key = Object.keys(GLOSSARY).find((k) => {
    const re = new RegExp(`\\b${k.replace(/[-\s]/g, "[-\\s]?")}s?\\b`, "i");
    return re.test(subject);
  });
  if (!key) return null;
  return {
    content: `${GLOSSARY[key]}\n\nWould you like an example of how to apply this in your own work?`,
    suggestions: ["How do I set SMART goals?", "What is the Eisenhower matrix?", "What is a RACI?"],
  };
}

function fallbackReply(text: string, seed: number): ChatReply {
  const phrase = echoPhrase(text) || "this";
  const role = detectRole(text);
  const who = role === "manager" ? "your manager" : role === "client" ? "the client" : role === "colleague" ? "your colleague" : role === "report" ? "your team member" : role === "team" ? "your team" : "the people involved";
  const opener = pick(
    [
      `Let's work through **${phrase}** step by step.`,
      `Good question. Here's a practical way to approach **${phrase}**.`,
      `Here's how I'd tackle **${phrase}** in a workplace setting.`,
    ],
    seed,
  );
  return {
    content: [
      opener,
      list([
        "**Define the outcome you want.** Write one sentence describing what “resolved” or “done” looks like.",
        `**Clarify expectations with ${who}.** Confirm priorities, constraints and deadlines before investing time.`,
        "**Gather the facts.** Collect the data, examples or documents you need so decisions aren't based on assumptions.",
        "**Choose the smallest next step** you can take today — a message, a 15-minute draft or a quick call.",
        "**Follow up in writing** to confirm what was agreed and keep everyone aligned.",
      ]),
      "If you share a little more context — who's involved, the deadline and what you've tried — I can give you more specific advice.",
    ].join("\n\n"),
    suggestions: STARTER_SUGGESTIONS.slice(0, 3),
  };
}

export function respond(input: string, history: ChatMessage[] = []): ChatReply {
  const text = input.trim();
  const seed = hash(text.toLowerCase() + history.length);
  const words = text.split(/\s+/).length;

  if (!text) return { content: "Ask me anything about work — emails, planning, meetings, feedback or career growth.", suggestions: STARTER_SUGGESTIONS };

  if (/^(hi|hello|hey|hiya|good (morning|afternoon|evening)|howzit|sawubona|molo|dumela)\b/i.test(text) && words <= 5) {
    const hour = new Date().getHours();
    const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    return {
      content: `Good ${part}! 👋 I'm your workplace assistant. I can help you:\n\n- **Plan and prioritise** your tasks\n- **Draft professional emails** in any tone\n- **Handle tricky situations** — feedback, conflict, negotiations\n- **Explain workplace terms** like OKRs, KPIs or Scrum\n\nWhat's on your plate today?`,
      suggestions: STARTER_SUGGESTIONS,
    };
  }

  if (/^(thanks|thank you|thx|cheers|great|awesome|perfect|nice|that helps|helpful)\b/i.test(text) && words <= 6) {
    const last = lastAssistantTopic(history);
    return {
      content: pick(["You're welcome! Anything else I can help with?", "Glad that helped! What would you like to tackle next?", "Happy to help — good luck with it!"], seed) +
        (last ? ` If you'd like, I can go deeper on ${last.label.toLowerCase()}.` : ""),
      suggestions: last ? last.suggestions : STARTER_SUGGESTIONS.slice(0, 3),
    };
  }

  if (/\b(what can you do|who are you|what are you|how do you work|help$|^help\b|your capabilities)\b/i.test(text)) {
    return {
      content: `I'm an AI-style workplace assistant that runs entirely in your browser. I can:\n\n1. **Give practical advice** on ${TOPICS.length}+ workplace topics, from meetings and deadlines to salary talks and burnout.\n2. **Draft emails** — try “Write a friendly email to Sam thanking him for his help”.\n3. **Prioritise tasks** — try “Plan my day: budget review 2h, client call, emails”.\n4. **Explain jargon** — try “What is a RACI?”\n\nI don't access the internet or your personal data, so please double-check important details.`,
      suggestions: STARTER_SUGGESTIONS,
    };
  }

  const last = lastAssistantTopic(history);
  if (last && /^(tell me more|more|go on|continue|elaborate|explain more|what else|another tip|more tips|anything else|go deeper|deeper)\b/i.test(text)) {
    return moreReply(last, history, seed);
  }

  if (/\bmake it (more )?(friendl\w*|casual|persuasive|formal)\b/i.test(text)) {
    const lastUserEmail = [...history].reverse().find((m) => m.role === "user" && /\b(email|message|letter)\b/i.test(m.content) && /\b(write|draft|compose)\b/i.test(m.content));
    if (lastUserEmail) return emailReply(`${lastUserEmail.content} ${text}`, seed);
  }

  if (/\b(write|draft|compose|create)\b.*\b(email|e-mail|message|letter|note)\b/i.test(text)) return emailReply(text, seed);

  if (/\b(plan my (day|week)|schedule (my|these)|prioriti[sz]e (these|my|the following)|help me plan|order these tasks)\b/i.test(text) || (/^(prioriti[sz]e|plan)\b/i.test(text) && text.includes(":"))) {
    const plan = planReply(text);
    if (plan) return plan;
  }

  const definition = /^(what(?:'s| is| are| does)|define|meaning of|explain)\b/i.test(text) ? glossaryReply(text) : null;
  if (definition) return definition;

  const scored = scoreTopics(text);
  if (scored[0]) return topicReply(scored[0].topic, text, seed, history);

  const glossaryAny = glossaryReply(text);
  if (glossaryAny) return glossaryAny;

  if (OFF_TOPIC.test(text)) {
    return {
      content: `I'm focused on workplace productivity, so I'm not the best source for that one. But if it's connected to work — say, planning a team event, a client conversation or managing your time — I'd be glad to help!`,
      suggestions: STARTER_SUGGESTIONS.slice(0, 3),
    };
  }

  return fallbackReply(text, seed);
}
