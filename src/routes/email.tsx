import { createFileRoute } from "@tanstack/react-router";
import { History, Mail, RefreshCw, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AiDisclaimer } from "@/components/app/ai-disclaimer";
import { CopyButton } from "@/components/app/copy-button";
import { PageHeader, SectionTitle } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateEmail, INTENT_LABELS, type EmailLength, type EmailOutput, type Tone } from "@/lib/ai/email";
import { recordActivity, uid, useLocalStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/email")({
  head: () => ({
    meta: [
      { title: "Smart Email Generator — AI Workplace Productivity Assistant" },
      { name: "description", content: "Describe the email you need and get a professional draft in a formal, friendly or persuasive tone." },
      { property: "og:title", content: "Smart Email Generator" },
      { property: "og:description", content: "Describe the email you need and get a professional draft in a formal, friendly or persuasive tone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmailPage,
});

const TONES: { id: Tone; label: string; hint: string }[] = [
  { id: "formal", label: "Formal", hint: "Polished and respectful" },
  { id: "friendly", label: "Friendly", hint: "Warm and relaxed" },
  { id: "persuasive", label: "Persuasive", hint: "Confident, benefit-led" },
];

const LENGTHS: { id: EmailLength; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "standard", label: "Standard" },
  { id: "detailed", label: "Detailed" },
];

const EXAMPLES = [
  "Ask my manager for two days of annual leave next Thursday and Friday",
  "Follow up with the client about the signed contract by Friday",
  "Apologise to Sarah for missing this morning's meeting",
  "Thank the team for their hard work on the product launch",
  "Request an extension on the quarterly report until next week",
  "Invite everyone to the year-end function on 12 December at 3pm",
];

interface Draft extends EmailOutput {
  id: string;
  tone: Tone;
  instructions: string;
  at: number;
}

function EmailPage() {
  const [instructions, setInstructions] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sender, setSender] = useLocalStorage("sender-name", "");
  const [keyPoints, setKeyPoints] = useState("");
  const [tone, setTone] = useState<Tone>("formal");
  const [length, setLength] = useState<EmailLength>("standard");
  const [variation, setVariation] = useState(0);
  const [result, setResult] = useState<EmailOutput | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafts, setDrafts] = useLocalStorage<Draft[]>("email-drafts", []);

  function run(nextTone = tone, nextLength = length, nextVariation = variation, save = true) {
    if (instructions.trim().length < 5) {
      toast.error("Tell me a little more about the email you need.");
      return;
    }
    const out = generateEmail({ instructions, recipient, sender, keyPoints, tone: nextTone, length: nextLength, variation: nextVariation });
    setResult(out);
    setSubject(out.subject);
    setBody(out.body);
    if (save) {
      setDrafts((prev) => [{ ...out, id: uid(), tone: nextTone, instructions, at: Date.now() }, ...prev].slice(0, 8));
      recordActivity("email", `Email: ${out.subject}`);
    }
  }

  function changeTone(t: Tone) {
    setTone(t);
    if (result) run(t, length, variation, false);
  }
  function changeLength(l: EmailLength) {
    setLength(l);
    if (result) run(tone, l, variation, false);
  }

  const fullText = `Subject: ${subject}\n\n${body}`;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Smart Email Generator"
        description="Describe what you need to say. The assistant works out the purpose, recipient and dates, then writes a ready-to-edit draft."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <form
          className="surface-card space-y-6 p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            setVariation(0);
            run(tone, length, 0);
          }}
        >
          <div>
            <SectionTitle step="1" title="What's the email about?" hint="Plain language is fine — include who it's for and any dates." />
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="e.g. Ask my manager for two days of leave next Thursday and Friday"
              className="resize-none rounded-xl text-[15px]"
              aria-label="Email instructions"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 4).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setInstructions(ex)}
                  className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {ex.length > 46 ? ex.slice(0, 44) + "…" : ex}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle step="2" title="Choose a tone" />
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tone">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={tone === t.id}
                  onClick={() => changeTone(t.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    tone === t.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{t.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 inline-flex rounded-xl bg-muted p-1" role="radiogroup" aria-label="Length">
              {LENGTHS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={length === l.id}
                  onClick={() => changeLength(l.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    length === l.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionTitle step="3" title="Optional details" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recipient">Recipient name</Label>
                <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="e.g. Thandi" maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sender">Your name</Label>
                <Input id="sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Used in the sign-off" maxLength={60} />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="points">Key points (one per line)</Label>
              <Textarea
                id="points"
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder={"Handover notes are ready\nSipho will cover urgent queries"}
                className="resize-none rounded-xl"
              />
            </div>
          </div>

          <Button type="submit" variant="hero" size="lg" className="w-full">
            <Wand2 /> Generate email
          </Button>
        </form>

        <div className="space-y-4">
          <div className="surface-card flex min-h-[420px] flex-col p-5 sm:p-6">
            {result ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    {INTENT_LABELS[result.intent]}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{tone}</span>
                  {result.recipient && (
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">To: {result.recipient}</span>
                  )}
                  {result.deadline && (
                    <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-[11px] font-semibold text-warning">Date: {result.deadline}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{body.split(/\s+/).filter(Boolean).length} words</span>
                </div>
                <Label htmlFor="subject" className="text-xs text-muted-foreground">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 font-semibold" />
                <Label htmlFor="body" className="mt-4 text-xs text-muted-foreground">Message (you can edit it)</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1 min-h-[300px] flex-1 resize-y rounded-xl text-[15px] leading-relaxed"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <CopyButton text={fullText} label="Copy email" variant="default" size="default" />
                  <Button
                    type="button"
                    variant="soft"
                    onClick={() => {
                      const v = variation + 1;
                      setVariation(v);
                      run(tone, length, v, false);
                    }}
                  >
                    <RefreshCw /> Rephrase
                  </Button>
                  <Button asChild variant="ghost">
                    <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>Open in mail app</a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <Sparkles className="size-6" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-foreground">Your draft will appear here</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Describe your email on the left and press Generate. You can switch tone or length afterwards and the draft updates instantly.
                </p>
              </div>
            )}
          </div>
          <AiDisclaimer compact />
        </div>
      </div>

      {drafts.length > 0 && (
        <section className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Recent drafts</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setDrafts([])}>
              <Trash2 /> Clear
            </Button>
          </div>
          <ul className="grid gap-3 md:grid-cols-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    setInstructions(d.instructions);
                    setTone(d.tone);
                    setResult(d);
                    setSubject(d.subject);
                    setBody(d.body);
                  }}
                  className="w-full rounded-xl border border-border bg-muted/40 p-4 text-left transition-colors hover:border-primary/40"
                >
                  <p className="truncate text-sm font-semibold text-foreground">{d.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.instructions}</p>
                  <p className="mt-2 text-[11px] font-semibold capitalize text-primary">
                    {d.tone} · {INTENT_LABELS[d.intent]}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
