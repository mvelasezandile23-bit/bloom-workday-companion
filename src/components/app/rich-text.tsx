import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Renders the lightweight markdown the assistant produces: paragraphs, bold, numbered and bulleted lists. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\d+\.\s/.test(l)))
          return (
            <ol key={bi} className="space-y-2">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-bold text-secondary-foreground">
                    {l.match(/^(\d+)/)?.[1]}
                  </span>
                  <span>{inline(l.replace(/^\d+\.\s/, ""))}</span>
                </li>
              ))}
            </ol>
          );
        if (lines.every((l) => /^[-•]\s/.test(l)))
          return (
            <ul key={bi} className="space-y-1.5">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{inline(l.replace(/^[-•]\s/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        const [first, ...rest] = lines;
        if (rest.length && rest.every((l) => /^(\d+\.|[-•])\s/.test(l))) {
          return (
            <div key={bi} className="space-y-2">
              <p>{inline(first)}</p>
              <RichText text={rest.join("\n")} />
            </div>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {inline(block)}
          </p>
        );
      })}
    </div>
  );
}
