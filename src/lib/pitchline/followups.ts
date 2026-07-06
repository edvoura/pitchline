import type { Lead } from "./types";

export type FollowUpBucket = "overdue" | "today" | "upcoming";

/** Local calendar date as YYYY-MM-DD (matches how the store stores dates). */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

const CLOSED: Lead["stage"][] = ["won", "lost"];

/** Which follow-up bucket a lead falls into, or null if none / closed. */
export function followUpBucket(lead: Lead, today = todayISO()): FollowUpBucket | null {
  if (!lead.followUp) return null;
  if (CLOSED.includes(lead.stage)) return null;
  if (lead.followUp < today) return "overdue";
  if (lead.followUp === today) return "today";
  return "upcoming";
}

export interface FollowUpGroups {
  overdue: Lead[];
  dueToday: Lead[];
  upcoming: Lead[];
  /** overdue + due today — the count that should nag the operator */
  actionable: number;
}

export function getFollowUps(leads: Lead[], today = todayISO()): FollowUpGroups {
  const overdue: Lead[] = [];
  const dueToday: Lead[] = [];
  const upcoming: Lead[] = [];

  for (const l of leads) {
    const b = followUpBucket(l, today);
    if (b === "overdue") overdue.push(l);
    else if (b === "today") dueToday.push(l);
    else if (b === "upcoming") upcoming.push(l);
  }

  const byDate = (a: Lead, b: Lead) => (a.followUp ?? "").localeCompare(b.followUp ?? "");
  overdue.sort(byDate);
  dueToday.sort(byDate);
  upcoming.sort(byDate);

  return { overdue, dueToday, upcoming, actionable: overdue.length + dueToday.length };
}

/** Human "3 days overdue" / "due today" / "in 2 days" label. */
export function relativeDue(dateISO: string, today = todayISO()): string {
  const a = new Date(dateISO + "T00:00:00");
  const b = new Date(today + "T00:00:00");
  const days = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (days === 0) return "due today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}
