import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ icon: Icon, title, description, actions }: { icon: LucideIcon; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
          <Icon className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ step, title, hint }: { step?: string; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {step && (
        <span className="grid size-7 place-items-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">{step}</span>
      )}
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
