import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlarmClock,
  CalendarClock,
  Check,
  ArrowRight,
  Plus,
  Upload,
  Wand2,
  Send,
  Eye,
  MessageSquare,
  Trophy,
  LayoutList,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { usePitchline } from "@/lib/pitchline/store";
import { useUI } from "@/lib/pitchline/ui";
import { getFollowUps, relativeDue, type FollowUpBucket } from "@/lib/pitchline/followups";
import { STAGES } from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Pitchline" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { leads, demos, setActiveLead, updateLead, setStage } = usePitchline();
  const { setAddOpen, setImportOpen } = useUI();
  const navigate = useNavigate();

  const follow = useMemo(() => getFollowUps(leads), [leads]);

  const pipeline = useMemo(
    () => leads.filter((l) => l.qualification !== "rejected"),
    [leads],
  );

  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of pipeline) m[l.stage] = (m[l.stage] ?? 0) + 1;
    return m;
  }, [pipeline]);

  const pending = leads.filter((l) => l.qualification === "pending");
  const readyToSend = leads.filter(
    (l) => demos[l.id] && (l.stage === "demo_built" || l.stage === "qualified"),
  );
  const awaitingReply = leads.filter((l) => l.stage === "sent" || l.stage === "viewed");

  const sent = pipeline.filter((l) =>
    ["sent", "viewed", "replied", "won", "lost"].includes(l.stage),
  ).length;
  const won = stageCounts["won"] ?? 0;
  const winRate = sent ? Math.round((won / sent) * 100) : 0;

  const openLead = (id: string) => {
    setActiveLead(id);
    navigate({ to: "/tracker" });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={`${pipeline.length} active leads · ${follow.actionable} follow-up${follow.actionable === 1 ? "" : "s"} need attention`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
            >
              <Upload className="h-4 w-4" /> Import
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New lead
            </button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {/* Metric strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label="Needs qualification"
            value={pending.length}
            icon={LayoutList}
            token="var(--status-scraped)"
            to="/leads"
          />
          <Metric
            label="Ready to send"
            value={readyToSend.length}
            icon={Send}
            token="var(--status-demo)"
            to="/preview"
          />
          <Metric
            label="Awaiting reply"
            value={awaitingReply.length}
            icon={Eye}
            token="var(--status-viewed)"
            to="/tracker"
          />
          <Metric
            label="Win rate"
            value={`${winRate}%`}
            sub={`${won} won / ${sent} sent`}
            icon={Trophy}
            token="var(--status-won)"
            to="/tracker"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Follow-ups — the nag panel */}
          <section className="lg:col-span-2 rounded-lg border border-border bg-surface">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <AlarmClock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Follow-ups</h2>
                {follow.actionable > 0 && (
                  <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    {follow.actionable} due
                  </span>
                )}
              </div>
              <Link
                to="/tracker"
                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
              >
                Open tracker <ArrowRight className="h-3 w-3" />
              </Link>
            </header>

            <div className="divide-y divide-border/60">
              <FollowGroup
                title="Overdue"
                bucket="overdue"
                leads={follow.overdue}
                onOpen={openLead}
                onDone={(id) => updateLead(id, { followUp: undefined })}
              />
              <FollowGroup
                title="Due today"
                bucket="today"
                leads={follow.dueToday}
                onOpen={openLead}
                onDone={(id) => updateLead(id, { followUp: undefined })}
              />
              <FollowGroup
                title="Upcoming"
                bucket="upcoming"
                leads={follow.upcoming.slice(0, 5)}
                onOpen={openLead}
                onDone={(id) => updateLead(id, { followUp: undefined })}
              />

              {follow.overdue.length +
                follow.dueToday.length +
                follow.upcoming.length ===
                0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <CalendarClock className="h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No follow-ups scheduled.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Set a follow-up date on any lead in the tracker.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Right column: queues + funnel */}
          <div className="space-y-6">
            {/* Work queues */}
            <section className="rounded-lg border border-border bg-surface">
              <header className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Next actions</h2>
              </header>
              <div className="p-2">
                <QueueRow
                  icon={LayoutList}
                  label="Qualify new leads"
                  count={pending.length}
                  to="/leads"
                  token="var(--status-scraped)"
                />
                <QueueRow
                  icon={Wand2}
                  label="Build demos"
                  count={pipeline.filter((l) => l.qualification === "qualified" && !demos[l.id]).length}
                  to="/generator"
                  token="var(--status-qualified)"
                />
                <QueueRow
                  icon={Send}
                  label="Send ready demos"
                  count={readyToSend.length}
                  to="/preview"
                  token="var(--status-demo)"
                />
                <QueueRow
                  icon={MessageSquare}
                  label="Chase replies"
                  count={awaitingReply.length}
                  to="/tracker"
                  token="var(--status-viewed)"
                />
              </div>
            </section>

            {/* Funnel */}
            <section className="rounded-lg border border-border bg-surface">
              <header className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Pipeline</h2>
              </header>
              <div className="space-y-2 p-4">
                {STAGES.map((s) => {
                  const count = stageCounts[s.id] ?? 0;
                  const pct = pipeline.length
                    ? Math.round((count / pipeline.length) * 100)
                    : 0;
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span
                        className="w-20 shrink-0 text-xs"
                        style={{ color: s.token }}
                      >
                        {s.label}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: s.token }}
                        />
                      </div>
                      <span className="mono w-6 shrink-0 text-right text-xs text-muted-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-4 py-3 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Press <kbd className="mono rounded border border-border px-1">⌘K</kbd> for the
          command palette, or <kbd className="mono rounded border border-border px-1">?</kbd>{" "}
          to see every shortcut.
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  icon: Icon,
  token,
  to,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  token: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-surface p-4 transition hover:border-ring/40 hover:bg-accent/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4" style={{ color: token }} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Link>
  );
}

function QueueRow({
  icon: Icon,
  label,
  count,
  to,
  token,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  to: string;
  token: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-accent/50"
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-md"
        style={{ backgroundColor: `color-mix(in oklab, ${token} 15%, transparent)` }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: token }} />
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className={cn(
          "mono rounded px-1.5 py-0.5 text-[11px] font-semibold",
          count > 0 ? "bg-secondary text-foreground" : "text-muted-foreground/40",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

function FollowGroup({
  title,
  bucket,
  leads,
  onOpen,
  onDone,
}: {
  title: string;
  bucket: FollowUpBucket;
  leads: { id: string; business: string; industry: string; followUp?: string }[];
  onOpen: (id: string) => void;
  onDone: (id: string) => void;
}) {
  if (leads.length === 0) return null;
  const tone =
    bucket === "overdue"
      ? "text-destructive"
      : bucket === "today"
        ? "text-status-sent"
        : "text-muted-foreground";

  return (
    <div className="px-2 py-2">
      <div className={cn("px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider", tone)}>
        {title} · {leads.length}
      </div>
      {leads.map((l) => (
        <div
          key={l.id}
          className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
        >
          <button
            onClick={() => onOpen(l.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="truncate text-sm font-medium">{l.business}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {l.industry}
              {l.followUp ? ` · ${relativeDue(l.followUp)}` : ""}
            </div>
          </button>
          <button
            onClick={() => onDone(l.id)}
            title="Clear follow-up"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-secondary hover:text-status-won group-hover:opacity-100"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
