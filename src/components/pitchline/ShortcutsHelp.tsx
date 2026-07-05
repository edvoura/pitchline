import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useUI } from "@/lib/pitchline/ui";

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: "Global",
    items: [
      [["⌘", "K"], "Open command palette"],
      [["?"], "Show this help"],
      [["/"], "Search leads"],
      [["Esc"], "Close dialog / clear"],
    ],
  },
  {
    title: "Navigate",
    items: [
      [["1"], "Leads"],
      [["2"], "Prompt Generator"],
      [["3"], "Demo Preview"],
      [["4"], "Demo Tracker"],
      [["5"], "Templates"],
    ],
  },
  {
    title: "Actions",
    items: [
      [["I"], "Import leads from CSV"],
      [["N"], "Add a new lead"],
    ],
  },
  {
    title: "Leads table",
    items: [
      [["J", "/", "K"], "Move row cursor down / up"],
      [["Q"], "Qualify highlighted lead"],
      [["X"], "Reject highlighted lead"],
      [["Enter"], "Generate demo for highlighted lead"],
    ],
  },
];

function Key({ k }: { k: string }) {
  if (k === "/") return <span className="px-0.5 text-muted-foreground">/</span>;
  return (
    <kbd className="mono inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-surface px-1.5 text-[11px] font-semibold text-foreground">
      {k}
    </kbd>
  );
}

export function ShortcutsHelp() {
  const { helpOpen, setHelpOpen } = useUI();
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Move through Pitchline without touching the mouse.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mono mb-2 text-[11px] uppercase tracking-wider text-primary">
                {g.title}
              </div>
              <ul className="space-y-2">
                {g.items.map(([keys, label], i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {keys.map((k, j) => (
                        <Key key={j} k={k} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
