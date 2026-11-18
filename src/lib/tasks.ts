import { useLocalStorage, uid } from "./storage";
import { parseTaskLine, type Task } from "./ai/planner";

export function useTasks() {
  return useLocalStorage<Task[]>("tasks", []);
}

export const EXAMPLE_TASKS = [
  "Finish Q4 budget report for the director – urgent, 2h, due tomorrow",
  "Prepare client presentation slides, 3h, due Friday",
  "Reply to supplier emails 30 min",
  "Team stand-up meeting 30 min today",
  "Book venue for team year-end function, due next week",
  "Update project tracker 45 min",
  "Tidy shared drive folders – low priority",
];

export function tasksFromText(text: string, now = new Date()): Task[] {
  return text
    .split("\n")
    .map((l) => parseTaskLine(l, now))
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t, i) => ({ ...t, id: uid(), done: false, createdAt: Date.now() + i }));
}
