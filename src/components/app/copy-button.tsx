import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

export function CopyButton({ text, label = "Copy", ...props }: { text: string; label?: string } & ButtonProps) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="soft"
      size="sm"
      {...props}
      onClick={async () => {
        await copyText(text);
        setDone(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check /> : <Copy />}
      {label && <span>{done ? "Copied" : label}</span>}
    </Button>
  );
}
