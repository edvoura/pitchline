import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LayoutList,
  SlidersHorizontal,
  MonitorPlay,
  KanbanSquare,
  Bookmark,
  Zap,
  Search,
  Keyboard,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePitchline } from "@/lib/pitchline/store";
import { useUI } from "@/lib/pitchline/ui";
import { getFollowUps } from "@/lib/pitchline/followups";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "0" },
  { to: "/leads", label: "Leads", icon: LayoutList, key: "1" },
  { to: "/generator", label: "Prompt Generator", icon: SlidersHorizontal, key: "2" },
  { to: "/preview", label: "Demo Preview", icon: MonitorPlay, key: "3" },
  { to: "/tracker", label: "Demo Tracker", icon: KanbanSquare, key: "4" },
  { to: "/templates", label: "Templates", icon: Bookmark, key: "5" },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { leads, signOut } = usePitchline();
  const { setCommandOpen, setHelpOpen } = useUI();

  const followUps = getFollowUps(leads).actionable;

  const counts = {
    "/leads": leads.filter((l) => l.qualification === "pending").length,
    "/tracker": leads.filter((l) =>
      ["sent", "viewed", "replied"].includes(l.stage),
    ).length,
  } as Record<string, number>;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <span className="text-[15px] font-bold tracking-tight">Pitchline</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(item.to + "/");
          const count = counts[item.to];
          const alert = item.to === "/" && followUps > 0 ? followUps : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {alert ? (
                <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[11px] font-semibold text-destructive">
                  {alert}
                </span>
              ) : count ? (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {count}
                </span>
              ) : (
                <span className="mono text-[11px] text-muted-foreground/40">
                  {item.key}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 px-3 py-2">
        <button
          onClick={() => setCommandOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Command</span>
          <span className="mono rounded border border-border px-1 text-[10px] text-muted-foreground/60">
            ⌘K
          </span>
        </button>
        <button
          onClick={() => setHelpOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Keyboard className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Shortcuts</span>
          <span className="mono rounded border border-border px-1 text-[10px] text-muted-foreground/60">
            ?
          </span>
        </button>
      </div>

      <div className="border-t border-sidebar-border px-5 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-foreground">Trendtactics Digital</div>
          <div className="text-[11px] text-muted-foreground">Operator console</div>
        </div>
        <button
          onClick={signOut}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
