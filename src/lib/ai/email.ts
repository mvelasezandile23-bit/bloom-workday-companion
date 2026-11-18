import {
  capitalize,
  clean,
  ensurePeriod,
  findDatePhrase,
  findTime,
  hash,
  pick,
  stripEndPunct,
  titleCase,
  toSecondPerson,
  truncateWords,
} from "./text";

export type Tone = "formal" | "friendly" | "persuasive";
export type EmailLength = "short" | "standard" | "detailed";

export type EmailIntent =
  | "meeting"
  | "followup"
  | "request"
  | "apology"
  | "thanks"
  | "proposal"
  | "leave"
  | "extension"
  | "introduction"
  | "complaint"
  | "invitation"
  | "reminder"
  | "update"
  | "resignation"
  | "application"
  | "feedback"
  | "general";

export const INTENT_LABELS: Record<EmailIntent, string> = {
  meeting: "Meeting request",
  followup: "Follow-up",
  request: "Request",
  apology: "Apology",
  thanks: "Thank-you note",
  proposal: "Proposal",
  leave: "Leave request",
  extension: "Deadline extension",
  introduction: "Introduction",
  complaint: "Raising a concern",
  invitation: "Invitation",
  reminder: "Reminder",
  update: "Status update",
  resignation: "Resignation",
  application: "Job application",
  feedback: "Feedback request",
  general: "General message",
};

export interface EmailInput {
  instructions: string;
  recipient?: string;
  sender?: string;
  tone: Tone;
  length: EmailLength;
  keyPoints?: string;
  variation?: number;
}

export interface EmailOutput {
  subject: string;
  body: string;
  intent: EmailIntent;
  recipient: string | null;
  deadline: string | null;
  wordCount: number;
}

const INTENT_PATTERNS: [EmailIntent, RegExp][] = [
  ["resignation", /\b(resign|resignation|notice period|hand in my notice|last day at)\b/i],
  ["leave", /\b(annual leave|sick leave|day off|days off|time off|leave from|vacation|holiday|family responsibility|maternity|paternity)\b/i],
  ["extension", /\b(extension|extend the deadline|more time|postpone|push back|delay the deadline)\b/i],
  ["apology", /\b(apolog\w*|sorry|my mistake|missed the|for the delay|for missing)\b/i],
  ["complaint", /\b(complain\w*|unhappy|dissatisf\w*|not acceptable|poor service|raise a concern|issue with|problem with)\b/i],
  ["application", /\b(apply|application|vacancy|position of|job opening|cv|resume|internship)\b/i],
  ["thanks", /\b(thank\w*|appreciat\w*|grateful|gratitude)\b/i],
  ["invitation", /\b(invit\w*|webinar|workshop|launch event|celebration|party|join us|year-end function)\b/i],
  ["meeting", /\b(meet|meeting|call|catch up|catch-up|sync|1:1|one-on-one|schedule a|book a)\b/i],
  ["followup", /\b(follow up|follow-up|following up|checking in|haven't heard|any update)\b/i],
  ["reminder", /\b(remind\w*|don't forget|do not forget|overdue)\b/i],
  ["proposal", /\b(propos\w*|pitch|partnership|collaborat\w*|initiative|idea for|suggest\w*)\b/i],
  ["introduction", /\b(introduc\w*|new to the team|just joined|i have joined|myself)\b/i],
  ["feedback", /\b(feedback|your thoughts|review my|input on|opinion on)\b/i],
  ["update", /\b(update|progress|status|report back|weekly report|milestone)\b/i],
  ["request", /\b(request|ask\w*|need|could you|approval|approve|send me|share)\b/i],
];

export function detectIntent(text: string): EmailIntent {
  let best: EmailIntent = "general";
  let bestScore = 0;
  for (const [intent, re] of INTENT_PATTERNS) {
    const g = new RegExp(re.source, "gi");
    const score = (text.match(g) ?? []).length;
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

const ROLE_WORDS =
  /^(?:my\s+|our\s+|the\s+)?(manager|line manager|boss|team|client|customer|colleague|colleagues|supervisor|hr|landlord|lecturer|director|ceo|investors?|stakeholders?|everyone|staff|recruiter|hiring manager)\b/i;
const NAME = /^(?:my\s+|our\s+|the\s+)?([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?)/;

function readRecipient(rest: string): { name: string | null; role: string | null; consumed: number } {
  const role = rest.match(ROLE_WORDS);
  if (role) return { name: null, role: role[1].toLowerCase(), consumed: role[0].length };
  const name = rest.match(NAME);
  if (name) return { name: name[1], role: null, consumed: name[0].length };
  return { name: null, role: null, consumed: 0 };
}

type ClauseKind =
  | "ask"
  | "askIf"
  | "inform"
  | "thanks"
  | "apology"
  | "invite"
  | "topic"
  | "followup"
  | "remind"
  | "requestNoun"
  | "propose"
  | "apologyFirst"
  | "meet"
  | "general";

const CLAUSES: [ClauseKind, RegExp][] = [
  ["askIf", /\b(?:asking|ask|to ask|check(?:ing)?)\s+(?:\w+\s+){0,3}?(if|whether)\s+(.+)/i],
  ["ask", /\b(?:asking|ask|to ask|telling|tell)\s+(?:him|her|them|the team|everyone|\w+)\s+to\s+(.+)/i],
  ["ask", /\b(?:asking|ask|to ask)\s+(?:him|her|them|\w+\s+)?for\s+(.+)/i],
  ["followup", /\b(?:following up|follow up|to follow up)\s+(?:on|about|regarding)\s+(.+)/i],
  ["thanks", /\b(?:thanking|thank|to thank)\s+(?:\w+\s+){0,3}?for\s+(.+)/i],
  ["apology", /\b(?:apologi[sz]ing|apologi[sz]e|saying sorry|sorry)\s+(?:for|about)\s+(.+)/i],
  ["invite", /\b(?:inviting|invite|to invite)\s+(?:\w+\s+){0,3}?to\s+(.+)/i],
  ["remind", /\b(?:reminding|remind|to remind)\s+(?:\w+\s+){0,2}?(?:about|of|that|to)\s+(.+)/i],
  ["requestNoun", /\b(?:requesting|to request|request)\s+(.+)/i],
  ["propose", /\b(?:proposing|to propose|propose|pitching|suggesting)\s+(.+)/i],
  ["inform", /\b(?:telling|informing|letting|to let|let|to inform|inform)\s+(?:\w+\s+){0,2}?(?:know\s+)?(?:that\s+)?(.+)/i],
  ["topic", /\b(?:about|regarding|concerning|re:)\s+(.+)/i],
];

const PREAMBLE =
  /^(?:(?:can|could|would) you\s+|please\s+|help me\s+|i need to\s+|i want to\s+|i'd like to\s+)*(?:write|draft|compose|create|send|prepare|generate)\s+(?:me\s+)?(?:a|an)?\s*(?:[a-z-]+\s+){0,3}?(?:email|e-mail|message|note|letter|reply|response)\b\s*/i;

const NOT_NAMES =
  /^(?:I|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|The|A|An|My|Our|Your|Please|Q\d)$/;

function findRecipientAnywhere(raw: string): { name: string | null; role: string | null } {
  const re = /\b(?:to|with|for|email|message|ask|asking|tell|telling|remind|thank|thanking|invite|inviting)\s+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const r = readRecipient(raw.slice(m.index + m[0].length));
    if (r.role) return { name: null, role: r.role };
    if (r.name) {
      const first = r.name.split(" ")[0];
      if (!NOT_NAMES.test(first) && !/\d/.test(r.name)) {
        const second = r.name.split(" ")[1];
        return { name: second && NOT_NAMES.test(second) ? first : r.name, role: null };
      }
    }
  }
  return { name: null, role: null };
}

interface Parsed {
  kind: ClauseKind;
  action: string;
  recipientName: string | null;
  recipientRole: string | null;
}

export function parseInstructions(raw: string): Parsed {
  let text = clean(raw);
  let recipientName: string | null = null;
  let recipientRole: string | null = null;

  // Drop trailing meta-instructions such as "and need to apologise to Sarah".
  text = text.replace(/\s*,?\s*(?:and\s+)?(?:i\s+)?(?:need|want|have|would like)\s+to\s+(?:apologi[sz]e|say sorry|tell|inform|let|email|write|message)\b.*$/i, "");
  const pre = text.match(PREAMBLE) ?? text.match(/^(?:email|message|reply to|write to)\s+(?=(?:my |our |the )?(?:[A-Z]|manager|boss|team|client|hr|everyone|staff|colleague))/i);
  if (pre) text = text.slice(pre[0].length);
  const toMatch = pre && !/^(?:to|for)\s/i.test(text) && /^(?:email|message)\s+$/i.test(pre[0]) ? [""] : text.match(/^(?:to|for)\s+/i);
  if (toMatch) {
    const r = readRecipient(text.slice(toMatch[0].length));
    if (r.consumed) {
      recipientName = r.name;
      recipientRole = r.role;
      text = text.slice(toMatch[0].length + r.consumed).replace(/^[\s,]+/, "");
    }
  }
  if (!recipientName && !recipientRole) {
    const r = findRecipientAnywhere(clean(raw));
    recipientName = r.name;
    recipientRole = r.role;
  }

  const sentence = stripEndPunct(text.split(/(?<=[.!?])\s+/)[0] ?? text);
  for (const [kind, re] of CLAUSES) {
    const m = sentence.match(re);
    if (m) {
      const captured = kind === "askIf" ? `${m[1]} ${m[2]}` : m[1];
      return { kind, action: stripEndPunct(captured), recipientName, recipientRole };
    }
  }
  return { kind: "general", action: stripEndPunct(sentence || raw), recipientName, recipientRole };
}

function topicFrom(action: string, dropWhen: string[] = []) {
  let t = action
    .replace(/^to\s+/i, "")
    .replace(/^(?:if|whether)\s+(?:you\s+)?(?:can|could|would|will)?\s*/i, "")
    .replace(/^(?:you|I|we)\s+/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^(?:send|share|review|approve|provide|submit|complete|confirm|join|attend|prepare|update|sign|check|finali[sz]e|look at|give|get|bring|help with|help|discuss|arrange|book|schedule|organi[sz]e)\s+/i, "")
    .replace(/^(?:me|us)\s+/i, "")
    .replace(/^(?:the|a|an|your|our|my|their)\s+/i, "");
  for (const w of dropWhen) {
    if (w) t = t.replace(new RegExp(`\\s*(?:on|at|by|for)?\\s*${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"), "");
  }
  t = stripEndPunct(t.replace(/\s+(?:on|at|by|for)$/i, ""));
  return truncateWords(t || action, 8).replace(/…$/, "");
}

function benefitFor(text: string): string {
  const t = text.toLowerCase();
  if (/report|data|figures|numbers|analysis|spreadsheet|timesheet/.test(t))
    return "keep our reporting accurate and on schedule";
  if (/client|customer/.test(t)) return "deliver a better experience for our clients";
  if (/budget|cost|price|saving|invoice|payment/.test(t)) return "make better use of our budget";
  if (/project|launch|release|deadline|deliverable|roadmap/.test(t)) return "keep the project on track";
  if (/team|staff|culture|wellness|morale/.test(t)) return "strengthen how we work together as a team";
  if (/sales|revenue|growth|leads|market/.test(t)) return "drive measurable growth";
  if (/training|course|learn|skill/.test(t)) return "build skills that pay off across the team";
  return "move forward quickly and confidently";
}

function core(kind: ClauseKind, tone: Tone, a: string, benefit: string, seed: number): string {
  const lines: Record<ClauseKind, Record<Tone, string[]>> = {
    ask: {
      formal: [`I am writing to kindly request that you ${a}.`, `Would you kindly ${a}?`],
      friendly: [`Would you be able to ${a}?`, `Could you please ${a}? It would be a big help.`],
      persuasive: [
        `I'd like to ask you to ${a}. Having this in place will help us ${benefit}.`,
        `Could you ${a}? It's a small step that will help us ${benefit}.`,
      ],
    },
    askIf: {
      formal: [`Could you please let me know ${a}?`, `I would be grateful if you could confirm ${a}.`],
      friendly: [`Just wanted to check ${a}.`, `Quick question — could you let me know ${a}?`],
      persuasive: [`Could you confirm ${a}? A quick answer will help us ${benefit}.`],
    },
    inform: {
      formal: [`I would like to inform you that ${a}.`, `Please be advised that ${a}.`],
      friendly: [`Just a quick heads-up: ${a}.`, `I wanted to let you know that ${a}.`],
      persuasive: [`I wanted to make sure you heard this from me first: ${a}.`],
    },
    thanks: {
      formal: [`I would like to sincerely thank you for ${a}.`, `Please accept my heartfelt thanks for ${a}.`],
      friendly: [`I just wanted to say a huge thank you for ${a}!`, `Thank you so much for ${a} — it really made a difference.`],
      persuasive: [`Thank you for ${a}. It has made a real impact, and I'd love to build on that momentum.`],
    },
    apology: {
      formal: [`Please accept my sincere apologies for ${a}.`, `I would like to apologise for ${a}.`],
      friendly: [`I'm really sorry about ${a}.`, `I owe you an apology for ${a}.`],
      persuasive: [`I want to apologise for ${a} and, more importantly, share how I am putting it right.`],
    },
    invite: {
      formal: [`It is my pleasure to invite you to ${a}.`, `I would be delighted if you could join us for ${a}.`],
      friendly: [`I'd love for you to join us at ${a}!`, `You're invited to ${a} — it would be great to see you there.`],
      persuasive: [`I'd like to personally invite you to ${a}. It's a great opportunity to ${benefit}.`],
    },
    topic: {
      formal: [`I am writing regarding ${a}.`, `I would like to discuss ${a} with you.`],
      friendly: [`I wanted to touch base about ${a}.`, `I've been thinking about ${a} and wanted to share a few thoughts.`],
      persuasive: [`I'd like to share a few thoughts on ${a} that I believe will help us ${benefit}.`],
    },
    followup: {
      formal: [`I am following up on ${a}.`, `I am writing to follow up on ${a}.`],
      friendly: [`Just following up on ${a}.`, `Checking in on ${a} — any news?`],
      persuasive: [`I'm following up on ${a}, as I'm keen to keep things moving and help us ${benefit}.`],
    },
    remind: {
      formal: [`This is a courteous reminder about ${a}.`],
      friendly: [`Just a friendly reminder about ${a}.`, `Quick reminder about ${a}!`],
      persuasive: [`A quick reminder about ${a} — staying on top of this will help us ${benefit}.`],
    },
    requestNoun: {
      formal: [`I am writing to formally request ${a}.`, `I would like to request ${a}.`],
      friendly: [`I'd like to request ${a}, if that works for you.`],
      persuasive: [`I'd like to request ${a}, and I have planned ahead to make sure the timing works for everyone.`],
    },
    propose: {
      formal: [`I would like to propose ${a}.`, `I am writing to put forward a proposal: ${a}.`],
      friendly: [`I've got an idea I'd love to run by you: ${a}.`],
      persuasive: [`I'd like to propose ${a}. I'm confident it can help us ${benefit}.`],
    },
    apologyFirst: {
      formal: [`${capitalize(a)}, and I would like to offer my sincere apologies.`],
      friendly: [`${capitalize(a)} — I'm really sorry about that.`],
      persuasive: [`${capitalize(a)}. I want to apologise and, more importantly, share how I am putting it right.`],
    },
    meet: {
      formal: [`I would like to arrange a meeting to discuss ${a}.`, `I would appreciate the opportunity to meet and discuss ${a}.`],
      friendly: [`Could we find some time to chat about ${a}?`, `Would you be up for a quick catch-up about ${a}?`],
      persuasive: [`I'd like to set up a short, focused meeting about ${a} — I believe it will help us ${benefit}.`],
    },
    general: {
      formal: [`I am writing regarding ${a}.`],
      friendly: [`I wanted to reach out about ${a}.`],
      persuasive: [`I'd like to talk about ${a}, because I believe it can help us ${benefit}.`],
    },
  };
  return pick(lines[kind][tone], seed);
}

function extra(intent: EmailIntent, tone: Tone, ctx: { date: string | null; time: string | null; dateInAction: boolean; sender: string }): string | null {
  const when = ctx.date ? `${ctx.date}${ctx.time ? ` at ${ctx.time}` : ""}` : null;
  const f = tone === "formal";
  const fr = tone === "friendly";
  switch (intent) {
    case "meeting":
      if (when && !ctx.dateInAction)
        return f ? `Would ${when} be convenient for you? If not, I would be happy to accommodate a time that suits your schedule.`
          : fr ? `Does ${when} work for you? If not, just suggest another time.`
          : `I've pencilled in ${when} — it should take no more than 30 minutes and will give us a clear way forward.`;
      if (when) return f ? "Please let me know whether this time suits you, or suggest an alternative." : fr ? "Let me know if that time works, or suggest another!" : "Thirty minutes is all we need to agree on a clear plan.";
      return f ? "Please let me know a time that suits you this week, and I will send a calendar invitation."
        : fr ? "When are you free this week? I'll send over an invite."
        : "Could you share two or three slots that work for you? I'll make sure the meeting is focused and worth your time.";
    case "leave":
      return f ? "I will ensure that my responsibilities are covered and that any urgent work is handed over before my leave begins."
        : fr ? "I'll make sure everything is handed over and nothing urgent is left hanging before I go."
        : "I have already planned a handover so that the team stays fully on track while I'm away.";
    case "extension":
      return f ? `The additional time will allow me to deliver work of the standard you expect. I will share a progress update${when ? ` by ${when}` : " shortly"}.`
        : fr ? "A little extra time means I can get this right rather than rushed. I'll keep you posted on progress."
        : "A short extension will mean a stronger final result — and I'll keep you updated at every step so there are no surprises.";
    case "apology":
      return f ? "I have taken steps to ensure this does not happen again, and I appreciate your patience and understanding."
        : fr ? "I've put a fix in place so it won't happen again. Thanks for bearing with me."
        : "I've already put a clear fix in place and will check in personally to make sure everything is back on track.";
    case "complaint":
      return f ? "I would appreciate it if this matter could be investigated and resolved at your earliest convenience."
        : fr ? "I'd really appreciate your help getting this sorted."
        : "Resolving this quickly would go a long way towards maintaining a strong working relationship.";
    case "introduction":
      return f ? "I look forward to working with you and contributing to the team's success."
        : fr ? "I'm really looking forward to working with you all!"
        : "I'm excited to bring fresh energy to the team and would love to learn where I can add the most value.";
    case "resignation":
      return f ? "I am grateful for the opportunities I have been given and will do everything I can to ensure a smooth handover during my notice period."
        : "Thank you for the support and opportunities — I'll make sure the handover is as smooth as possible.";
    case "application":
      return f ? "I believe my skills and experience make me a strong fit for this role, and I have attached my CV for your consideration."
        : fr ? "I'd love the chance to bring my skills to your team — my CV is attached."
        : "I'm confident I can make an immediate contribution, and my attached CV shows the results I've delivered so far.";
    case "proposal":
      return f ? "I would be happy to prepare a short outline with timelines and expected outcomes."
        : fr ? "Happy to put together a quick outline if you're interested."
        : "I can share a one-page plan with clear costs, timelines and expected results within two days.";
    case "update":
      return f ? "Overall, the work is progressing as planned, and I will keep you informed of any changes."
        : fr ? "All in all, things are moving along nicely — I'll keep you posted."
        : "We're making strong progress, and a few quick decisions now will keep that momentum going.";
    case "feedback":
      return f ? "Your perspective would be greatly valued and would help me improve the final outcome."
        : fr ? "Even a few quick thoughts would be super helpful."
        : "Your input is the missing piece that will turn this from good to great.";
    case "thanks":
      return f ? "Your support is genuinely appreciated." : fr ? "I'm so grateful to have you on board." : "Let's carry that energy into the next phase.";
    case "invitation":
      return f ? `Kindly confirm your attendance${when && !ctx.dateInAction ? ` by ${when}` : " at your earliest convenience"}.`
        : fr ? "Let me know if you can make it!"
        : "Spaces are limited, so please confirm soon to secure your spot.";
    case "reminder":
      return when && !ctx.dateInAction ? (f ? `Please note that this is due ${when}.` : `Just a heads-up that this is due ${when}.`) : null;
    case "followup":
      return f ? "I understand you have a busy schedule and appreciate you taking the time to respond."
        : fr ? "No rush — I know things get busy!"
        : "A quick reply will help me plan the next steps and keep everything on schedule.";
    default:
      return null;
  }
}

function subjectFor(intent: EmailIntent, tone: Tone, topic: string, sender: string, full: string): string {
  const T = titleCase(topic);
  const t = topic;
  const s: Record<EmailIntent, Record<Tone, string>> = {
    meeting: { formal: `Meeting Request: ${T}`, friendly: `Quick catch-up about ${t}?`, persuasive: `30 minutes to move ${t} forward?` },
    request: { formal: `Request: ${T}`, friendly: `Quick favour: ${t}`, persuasive: `Action needed: ${T}` },
    followup: { formal: `Following Up: ${T}`, friendly: `Checking in on ${t}`, persuasive: `Next steps on ${t}` },
    apology: { formal: `Apologies Regarding ${T}`, friendly: `Sorry — ${t}`, persuasive: `Making things right: ${t}` },
    thanks: { formal: `Thank You: ${T}`, friendly: `Thank you for ${full}!`, persuasive: `Thank you — and what comes next` },
    proposal: { formal: `Proposal: ${T}`, friendly: `An idea about ${t}`, persuasive: `Opportunity: ${T}` },
    leave: { formal: `Leave Request: ${T}`, friendly: `Time-off request: ${t}`, persuasive: `Leave request (handover planned): ${T}` },
    extension: { formal: `Request for Deadline Extension: ${T}`, friendly: `A bit more time for ${t}?`, persuasive: `Extension request to deliver ${t} at its best` },
    introduction: { formal: `Introduction: ${sender || T}`, friendly: `Hello from ${sender || "your new colleague"}!`, persuasive: `Introduction — ${sender || T}` },
    complaint: { formal: `Formal Concern: ${T}`, friendly: `An issue with ${t}`, persuasive: `Let's resolve ${t} quickly` },
    invitation: { formal: `Invitation: ${T}`, friendly: `You're invited: ${t}!`, persuasive: `Join us: ${T}` },
    reminder: { formal: `Reminder: ${T}`, friendly: `Friendly reminder: ${t}`, persuasive: `Reminder: ${T}` },
    update: { formal: `Update: ${T}`, friendly: `Quick update on ${t}`, persuasive: `Progress update: ${T}` },
    resignation: { formal: `Letter of Resignation${sender ? ` – ${sender}` : ""}`, friendly: `My resignation${sender ? ` – ${sender}` : ""}`, persuasive: `Letter of Resignation${sender ? ` – ${sender}` : ""}` },
    application: { formal: `Application: ${T}`, friendly: `Application for ${t}`, persuasive: `Application: ${T}` },
    feedback: { formal: `Request for Feedback: ${T}`, friendly: `Your thoughts on ${t}?`, persuasive: `Your input on ${t}` },
    general: { formal: T, friendly: `About ${t}`, persuasive: T },
  };
  return capitalize(s[intent][tone]);
}

function greeting(tone: Tone, name: string | null, role: string | null, seed: number) {
  const teamish = role && /team|everyone|staff|colleagues|stakeholders|investors/.test(role);
  const display =
    name ??
    (teamish
      ? role === "everyone"
        ? "all"
        : titleCase(role!)
      : role === "hr"
        ? "HR Team"
        : role
          ? `[${titleCase(role)}'s Name]`
          : null);
  if (tone === "formal") return display ? `Dear ${display},` : "Dear Sir or Madam,";
  if (tone === "friendly") return display ? `${pick(["Hi", "Hello"], seed)} ${display},` : "Hi there,";
  return display ? `Hello ${display},` : "Hello,";
}

export function generateEmail(input: EmailInput): EmailOutput {
  const { tone, length } = input;
  const seed = hash(input.instructions + tone) + (input.variation ?? 0) * 13;
  const parsed = parseInstructions(input.instructions);
  const intentFromText = detectIntent(input.instructions);
  const intent: EmailIntent = intentFromText;

  const formName = input.recipient?.trim();
  const recipientName = formName || parsed.recipientName;
  const recipientRole = formName ? null : parsed.recipientRole;
  const sender = input.sender?.trim() || "";

  let action = toSecondPerson(parsed.action);
  let kind = parsed.kind;
  if (kind === "general") {
    if (/^(i|we)\b/i.test(action)) {
      kind = intent === "apology" ? "apologyFirst" : "inform";
    }
    action = action.replace(/^(?:an?\s+)?(?:email|message)\s+(?:about|regarding)\s+/i, "");
  }
  if (intent === "meeting" && (kind === "topic" || kind === "general")) kind = "meet";
  if (kind === "inform" || kind === "askIf") action = action.charAt(0).toLowerCase() + action.slice(1);
  if (/^i\b/.test(action) || /^I\b/.test(action)) action = "I" + action.slice(1);
  action = action.replace(/^i\b/, "I").replace(/\bi\b/g, "I");

  const date = findDatePhrase(input.instructions);
  const time = findTime(input.instructions);
  const dateInAction = !!(date && action.toLowerCase().includes(date.toLowerCase()));
  const benefit = benefitFor(input.instructions + " " + (input.keyPoints ?? ""));
  const points = (input.keyPoints ?? "")
    .split(/\n|;/)
    .map((p) => stripEndPunct(p.replace(/^[-*•\d.)\s]+/, "")))
    .filter(Boolean);

  const paragraphs: string[] = [];
  const direct = intent === "apology" || intent === "complaint" || intent === "resignation";
  if (length !== "short" && !direct) {
    const openers: Record<Tone, string[]> = {
      formal: ["I hope this email finds you well.", "I trust you are keeping well."],
      friendly: ["Hope you're having a great week!", "I hope your day is going well!"],
      persuasive: ["I'll keep this brief, as I know your time is valuable.", "I have something I think is well worth a minute of your time."],
    };
    paragraphs.push(pick(openers[tone], seed, 1));
  }

  const coreLine = core(kind, tone, action, benefit, seed);
  const ex = length === "short" && intent !== "meeting" ? null : extra(intent, tone, { date, time, dateInAction, sender });
  paragraphs.push(ex && length !== "short" ? `${coreLine} ${ex}` : ex ? `${coreLine} ${ex}` : coreLine);

  if (points.length) {
    const lead: Record<Tone, string> = {
      formal: "Please find the key points below:",
      friendly: "A few quick points:",
      persuasive: "Here's what this means in practice:",
    };
    paragraphs.push([lead[tone], ...points.map((p) => `• ${capitalize(p)}`)].join("\n"));
  }

  if (length === "detailed") {
    const details: Record<Tone, string[]> = {
      formal: [
        "Should it be helpful, I would be glad to arrange a brief call to discuss this in more detail.",
        "I am happy to provide any additional information or documentation you may require.",
      ],
      friendly: ["Happy to jump on a quick call if that's easier.", "If anything's unclear, just give me a shout and I'll fill in the gaps."],
      persuasive: [
        "I've thought through the details and I'm ready to get started as soon as you give the go-ahead.",
        "The sooner we align on this, the sooner we'll see the results — and I'll handle the heavy lifting.",
      ],
    };
    paragraphs.push(pick(details[tone], seed, 2));
  }

  const ctas: Record<Tone, string[]> = {
    formal:
      intent === "apology" || intent === "complaint"
        ? ["Thank you for your patience and understanding.", "Thank you for your time and attention to this matter."]
        : ["Please do not hesitate to contact me should you require any further information.", "I look forward to your response.", "Thank you for your time and consideration."],
    friendly: ["Let me know if you have any questions!", "Thanks so much — talk soon!", "Shout if there's anything I can help with."],
    persuasive: [
      /request|proposal|followup|update|general|reminder/.test(intent)
        ? `Could we agree on next steps by ${date && !/today|tomorrow/i.test(date) ? date.replace(/^(by|on|before)\s+/i, "") : "the end of the week"}?`
        : "Thank you for considering this — I'm happy to answer any questions.",
      "If you're on board, simply reply to this email and I'll take care of the rest.",
      "I'd really value your support on this — can I count on you?",
    ],
  };
  paragraphs.push(pick(ctas[tone], seed, 3));

  const signoffs: Record<Tone, string[]> = {
    formal: ["Kind regards,", "Yours sincerely,", "Best regards,"],
    friendly: ["Best,", "Cheers,", "Thanks again,"],
    persuasive: ["Looking forward to hearing from you,", "Best regards,"],
  };
  const signature = `${pick(signoffs[tone], seed, 4)}\n${sender || "[Your Name]"}`;

  const body = [greeting(tone, recipientName, recipientRole, seed), ...paragraphs.map((p) => p.includes("\n") ? p : ensurePeriod(p)), signature].join("\n\n");
  const drop = intent === "meeting" || intent === "invitation" ? [date ?? "", time ?? ""] : [time ?? ""];
  const topic = topicFrom(action, drop) || "our conversation";
  const subject = subjectFor(intent, tone, topic, sender, stripEndPunct(action));

  return {
    subject,
    body,
    intent,
    recipient: recipientName ?? (recipientRole ? titleCase(recipientRole) : null),
    deadline: date,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  };
}
