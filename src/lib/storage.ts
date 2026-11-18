import { useCallback, useEffect, useState } from "react";

const PREFIX = "wpa:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("wpa-storage", { detail: key }));
  } catch {
    /* storage full or disabled */
  }
}

/** SSR-safe localStorage state: starts with `initial`, loads the stored value after mount. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read(key, initial));
    setHydrated(true);
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read(key, initial));
    };
    window.addEventListener("wpa-storage", onChange);
    return () => window.removeEventListener("wpa-storage", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update, hydrated] as const;
}

export type ActivityType = "email" | "plan" | "chat";
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  at: number;
}

export interface Stats {
  emails: number;
  plans: number;
  chats: number;
}

export const EMPTY_STATS: Stats = { emails: 0, plans: 0, chats: 0 };

export function recordActivity(type: ActivityType, title: string) {
  const stats = read<Stats>("stats", EMPTY_STATS);
  const key = type === "email" ? "emails" : type === "plan" ? "plans" : "chats";
  write("stats", { ...stats, [key]: stats[key] + 1 });
  const list = read<Activity[]>("activity", []);
  const item: Activity = { id: uid(), type, title: title.slice(0, 90), at: Date.now() };
  write("activity", [item, ...list].slice(0, 12));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
