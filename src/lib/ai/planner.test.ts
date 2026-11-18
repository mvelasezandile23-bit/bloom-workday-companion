import { describe, expect, it } from "vitest";
import { analyseTask, buildDailySchedule, parseTaskLine, prioritise, type Task } from "./planner";

// Wednesday 18 Nov 2026, 09:00
const NOW = new Date(2026, 10, 18, 9, 0);

function task(p: Partial<Task>): Task {
  return { id: p.title ?? "t", title: "Task", urgency: 2, importance: 2, hours: 1, due: null, done: false, createdAt: 0, ...p };
}

describe("task prioritisation", () => {
  it("puts urgent and important work in 'Do first' with a deadline of today", () => {
    const t = analyseTask(task({ urgency: 3, importance: 3 }), NOW);
    expect(t.quadrant).toBe("do");
    expect(t.suggestedDeadline).toBe("2026-11-18");
  });

  it("marks important but not urgent work as 'Schedule'", () => {
    expect(analyseTask(task({ urgency: 1, importance: 3 }), NOW).quadrant).toBe("schedule");
  });

  it("marks urgent but low-importance work as 'Delegate'", () => {
    expect(analyseTask(task({ urgency: 3, importance: 1 }), NOW).quadrant).toBe("delegate");
  });

  it("treats a task due tomorrow as urgent even if urgency was set low", () => {
    expect(analyseTask(task({ urgency: 1, importance: 3, due: "2026-11-19" }), NOW).quadrant).toBe("do");
  });

  it("orders the most urgent and important task first", () => {
    const list = prioritise(
      [task({ title: "Low", urgency: 1, importance: 1 }), task({ title: "Top", urgency: 3, importance: 3 }), task({ title: "Mid" })],
      NOW,
    );
    expect(list.map((t) => t.title)).toEqual(["Top", "Mid", "Low"]);
  });
});

describe("daily schedule", () => {
  it("starts the top task at the start of the workday and includes a lunch break", () => {
    const { blocks } = buildDailySchedule(
      [task({ title: "Report", urgency: 3, importance: 3, hours: 3 }), task({ title: "Emails", hours: 2 })],
      { start: "09:00", end: "17:00" },
      NOW,
    );
    expect(blocks[0]).toMatchObject({ start: "09:00", title: "Report" });
    expect(blocks.some((b) => b.kind === "lunch" && b.start === "12:30")).toBe(true);
  });
});

describe("smart task parsing", () => {
  it("reads urgency, hours and due date from plain text", () => {
    const t = parseTaskLine("Prepare client presentation - urgent, 2h, due Friday", NOW)!;
    expect(t.urgency).toBe(3);
    expect(t.importance).toBe(3);
    expect(t.hours).toBe(2);
    expect(t.due).toBe("2026-11-20");
    expect(t.title).toBe("Prepare client presentation");
  });
});
