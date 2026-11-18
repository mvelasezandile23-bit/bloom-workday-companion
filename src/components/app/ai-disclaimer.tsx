import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiDisclaimer({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-4 text-sm", className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">Responsible AI: </span>
        {compact
          ? "AI-generated content can be inaccurate. Review and edit before you use it."
          : "Responses are generated automatically and may be incomplete or inaccurate. Always review, edit and fact-check before sending or acting on them, and don't rely on them for legal, HR, financial or medical decisions."}{" "}
        <Link to="/responsible-ai" className="font-semibold text-primary underline-offset-4 hover:underline">
          Learn more
        </Link>
      </p>
    </div>
  );
}
