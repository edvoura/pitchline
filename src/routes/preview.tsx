import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  RefreshCw,
  Wand2,
  Download,
  Copy,
  Check,
  Send,
  MonitorPlay,
  ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { usePitchline } from "@/lib/pitchline/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/preview")({
  head: () => ({ meta: [{ title: "Demo Preview — Pitchline" }] }),
  component: PreviewPage,
});

function PreviewPage() {
  const { leads, demos, activeLeadId, setActiveLead, generateDemo, refineDemo, markReady, setStage } =
    usePitchline();
  const navigate = useNavigate();

  const withDemos = leads.filter((l) => demos[l.id]);
  const lead = leads.find((l) => l.id === activeLeadId && demos[l.id]) ?? withDemos[0] ?? null;
  const demo = lead ? demos[lead.id] : null;

  const [refineText, setRefineText] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = (fn: () => void) => {
    setBusy(true);
    setTimeout(() => {
      fn();
      setBusy(false);
    }, 400);
  };

  const copyCode = async () => {
    if (!demo) return;
    await navigator.clipboard.writeText(demo.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    if (!demo || !lead) return;
    const blob = new Blob([demo.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${lead.business.toLowerCase().replace(/\s+/g, "-")}-demo.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markSent = () => {
    if (!lead) return;
    markReady(lead.id);
    setStage(lead.id, "sent");
    navigate({ to: "/tracker" });
  };

  if (!lead || !demo) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Demo Preview" subtitle="No demo generated yet" />
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-surface">
            <MonitorPlay className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold">Nothing to preview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a demo from the Prompt Generator first.
          </p>
          <Link
            to="/generator"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Wand2 className="h-4 w-4" /> Go to Generator
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <PageHeader
        title="Demo Preview"
        subtitle={`${lead.business} · ${demo.provider === "claude" ? "Claude" : "Gemini"}${
          demo.refinements.length ? ` · ${demo.refinements.length} refinement(s)` : ""
        }`}
        actions={
          <>
            {withDemos.length > 1 && (
              <div className="relative">
                <select
                  value={lead.id}
                  onChange={(e) => setActiveLead(e.target.value)}
                  className="h-8 appearance-none rounded-md border border-border bg-surface pl-2.5 pr-7 text-xs outline-none focus:border-ring"
                >
                  {withDemos.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.business}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
            {demo.ready && (
              <span className="rounded-full border border-status-won/40 bg-status-won/10 px-2.5 py-0.5 text-xs font-medium text-status-won">
                Ready to send
              </span>
            )}
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => run(() => generateDemo(lead.id))}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /> Regenerate
          </button>

          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2 py-1">
            <input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine — e.g. 'make the hero bigger, add a menu section'"
              className="h-7 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
              onKeyDown={(e) => {
                if (e.key === "Enter" && refineText.trim()) {
                  run(() => refineDemo(lead.id, refineText.trim()));
                  setRefineText("");
                }
              }}
            />
            <button
              onClick={() => {
                if (!refineText.trim()) return;
                run(() => refineDemo(lead.id, refineText.trim()));
                setRefineText("");
              }}
              disabled={busy || !refineText.trim()}
              className="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Wand2 className="h-3.5 w-3.5" /> Refine
            </button>
          </div>

          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
          >
            {copied ? <Check className="h-4 w-4 text-status-won" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy code"}
          </button>
          <button
            onClick={download}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            onClick={markSent}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Send className="h-4 w-4" /> Mark Ready & Send
          </button>
        </div>

        {/* iframe */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-white">
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                {demo.provider === "claude" ? "Claude" : "Gemini"} is generating…
              </div>
            </div>
          )}
          <iframe
            title={`${lead.business} demo`}
            srcDoc={demo.html}
            className="h-full w-full"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}
