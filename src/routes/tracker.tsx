import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ExternalLink, CalendarPlus, LayoutList, Columns3 } from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { StatusBadge } from "@/components/pitchline/StatusBadge";
import { usePitchline } from "@/lib/pitchline/store";
import { STAGES, type Stage } from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/tracker")({
  head: () => ({ meta: [{ title: "Demo Tracker — Pitchline" }] }),
  component: TrackerPage,
});

type SortKey = "stage" | "date";

function TrackerPage() {
  const { leads, demos, updateLead, setStage, setActiveLead } = usePitchline();

  const [view, setView] = useState<"table" | "kanban">("table");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [sort, setSort] = useState<SortKey>("date");

  const pipeline = useMemo(
    () => leads.filter((l) => l.qualification !== "rejected"),
    [leads],
  );

  const stageOrder = STAGES.reduce<Record<string, number>>((a, s, i) => {
    a[s.id] = i;
    return a;
  }, {});

  const filtered = useMemo(() => {
    let out = pipeline.filter((l) => stageFilter === "all" || l.stage === stageFilter);
    out = [...out].sort((a, b) => {
      if (sort === "stage") return stageOrder[a.stage] - stageOrder[b.stage];
      return (b.dateSent ?? b.dateScraped).localeCompare(a.dateSent ?? a.dateScraped);
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline, stageFilter, sort]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Demo Tracker"
        subtitle={`${pipeline.length} leads in the pipeline`}
        actions={
          <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <LayoutList className="h-3.5 w-3.5" /> Table
            </button>
            <button
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition",
                view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <Columns3 className="h-3.5 w-3.5" /> Board
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as Stage | "all")}
          className="h-8 rounded-md border border-input bg-input px-2 text-sm outline-none focus:border-ring"
        >
          <option value="all">Stage: All</option>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-8 rounded-md border border-input bg-input px-2 text-sm outline-none focus:border-ring"
        >
          <option value="date">Sort: Most recent</option>
          <option value="stage">Sort: Pipeline stage</option>
        </select>
      </div>

      {view === "table" ? (
        <div className="px-6 py-4">
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Business</th>
                  <th className="px-3 py-2.5 font-medium">Stage</th>
                  <th className="px-3 py-2.5 font-medium">Demo</th>
                  <th className="px-3 py-2.5 font-medium">Sent</th>
                  <th className="px-3 py-2.5 font-medium">Follow-up</th>
                  <th className="px-3 py-2.5 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border/60 align-top last:border-0 hover:bg-surface/50">
                    <td className="px-3 py-3">
                      <div className="font-medium">{l.business}</div>
                      <div className="text-xs text-muted-foreground">{l.industry}</div>
                    </td>
                    <td className="px-3 py-3">
                      <select
                        value={l.stage}
                        onChange={(e) => setStage(l.id, e.target.value as Stage)}
                        className="rounded-md border border-transparent bg-transparent text-xs outline-none hover:border-border"
                        style={{ color: STAGES.find((s) => s.id === l.stage)?.token }}
                      >
                        {STAGES.map((s) => (
                          <option key={s.id} value={s.id} className="bg-popover text-foreground">
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      {demos[l.id] ? (
                        <button
                          onClick={() => setActiveLead(l.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View demo <ExternalLink className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="mono px-3 py-3 text-xs text-muted-foreground">
                      {l.dateSent ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="date"
                          value={l.followUp ?? ""}
                          onChange={(e) => updateLead(l.id, { followUp: e.target.value })}
                          className="w-32 rounded border border-transparent bg-transparent text-xs text-muted-foreground outline-none hover:border-border focus:border-ring"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        value={l.notes}
                        onChange={(e) => updateLead(l.id, { notes: e.target.value })}
                        placeholder="Add note…"
                        className="w-full rounded border border-transparent bg-transparent text-xs outline-none placeholder:text-muted-foreground/60 hover:border-border focus:border-ring"
                      />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      Nothing in this stage.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-6 py-4">
          {STAGES.map((s) => {
            const items = pipeline.filter((l) => l.stage === s.id);
            return (
              <div key={s.id} className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-surface">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: s.token }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.token }} />
                    {s.label}
                  </span>
                  <span className="mono text-[11px] text-muted-foreground">{items.length}</span>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {items.map((l) => (
                    <div key={l.id} className="rounded-md border border-border bg-card p-2.5">
                      <div className="text-sm font-medium">{l.business}</div>
                      <div className="text-[11px] text-muted-foreground">{l.industry} · {l.location}</div>
                      {l.notes && (
                        <div className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground/80">{l.notes}</div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="py-4 text-center text-[11px] text-muted-foreground/50">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
