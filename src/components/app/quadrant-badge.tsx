import { cn } from "@/lib/utils";
import { QUADRANT_LABELS, type Quadrant } from "@/lib/ai/planner";

const STYLES: Record<Quadrant, string> = {
  do: "bg-primary text-primary-foreground",
  schedule: "bg-info-soft text-info",
  delegate: "bg-warning-soft text-warning",
  later: "bg-muted text-muted-foreground border border-border",
};

export const QUADRANT_BAR: Record<Quadrant, string> = {
  do: "bg-primary",
  schedule: "bg-info",
  delegate: "bg-warning",
  later: "bg-muted-foreground/40",
};

export function QuadrantBadge({ quadrant, className }: { quadrant: Quadrant; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STYLES[quadrant], className)}>
      {QUADRANT_LABELS[quadrant]}
    </span>
  );
}
