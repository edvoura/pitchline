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
  CheckSquare,
  AlertCircle,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { usePitchline } from "@/lib/pitchline/store";
import { sendOutreachEmailFn } from "@/lib/pitchline/server-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/preview")({
  head: () => ({ meta: [{ title: "Demo Preview — Pitchline" }] }),
  component: PreviewPage,
});

function PreviewPage() {
  const { leads, demos, activeLeadId, setActiveLead, generateDemo, refineDemo, markReady, setStage, generationStage } =
    usePitchline();
  const navigate = useNavigate();

  const withDemos = leads.filter((l) => demos[l.id]);
  const lead = leads.find((l) => l.id === activeLeadId && demos[l.id]) ?? withDemos[0] ?? null;
  const demo = lead ? demos[lead.id] : null;

  const [refineText, setRefineText] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const isGenerating = busy || !!(demo && demo.html === "<!-- generating -->") || generationStage !== null;
  const [showChecklist, setShowChecklist] = useState(true);

  const checklistConfig = [
    { id: "hero", label: "Hero communicates what this is within 3 seconds", hint: "Structural: Make the hero headline and value proposition more direct." },
    { id: "motion", label: "Visible motion/animation present (not flat/static)", hint: "Animation: Add scroll-triggered fade-ins per section and button hover states." },
    { id: "purpose", label: "Every section has a clear, single purpose", hint: "Structural: Reframe feature items around customer outcomes." },
    { id: "copy", label: "Copy sounds specific to this business, not generic", hint: "Copy: Rewrite copy using SNAP (Story, Need, Answer, Proof)." },
    { id: "cta", label: "Single, obvious CTA — no competing buttons", hint: "CTA: Make the main CTA prominent and remove competing buttons." },
    { id: "mood", label: "Mood matches what was intended", hint: "Direction: Adjust font pairing and color saturation to match mood." },
  ];

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    hero: true,
    motion: true,
    purpose: true,
    copy: true,
    cta: true,
    mood: true,
  });

  const uncheckedItems = checklistConfig.filter((item) => !checkedItems[item.id]);

  const run = async (fn: () => Promise<any> | any) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      toast.error(err.message || "Failed to execute AI action");
      console.error(err);
    } finally {
      setBusy(false);
    }
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

  const sendEmailOutreach = async () => {
    if (!lead) return;
    if (!lead.email) {
      toast.info(`No email listed for ${lead.business}. Stage updated to Sent.`);
      markReady(lead.id);
      setStage(lead.id, "sent");
      navigate({ to: "/tracker" });
      return;
    }

    run(async () => {
      try {
        await sendOutreachEmailFn({
          data: {
            toEmail: lead.email!,
            businessName: lead.business,
            leadId: lead.id,
          },
        });
        toast.success(`Outreach email sent to ${lead.email} via Resend!`);
      } catch (err: any) {
        toast.info(`Email dispatch info: ${err.message || "Stage updated to Sent"}`);
      } finally {
        markReady(lead.id);
        setStage(lead.id, "sent");
        navigate({ to: "/tracker" });
      }
    });
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
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} /> Regenerate
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
              disabled={isGenerating || !refineText.trim()}
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
            onClick={sendEmailOutreach}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" /> Send Email & Track
          </button>
        </div>

        {/* Pre-Send Quality Checklist (Part 4) */}
        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pre-Send Quality Checklist
              </span>
              {uncheckedItems.length > 0 ? (
                <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                  <AlertCircle className="h-3 w-3" />
                  {uncheckedItems.length} item(s) unchecked — consider hitting Refine first
                </span>
              ) : (
                <span className="rounded-full border border-status-won/30 bg-status-won/10 px-2 py-0.5 text-[11px] font-medium text-status-won">
                  All quality checks passed
                </span>
              )}
            </div>
            <button
              onClick={() => setShowChecklist(!showChecklist)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showChecklist ? "Hide checklist" : "Show checklist"}
            </button>
          </div>

          {showChecklist && (
            <div className="mt-2.5 grid grid-cols-1 gap-2 border-t border-border/60 pt-2.5 md:grid-cols-2 lg:grid-cols-3">
              {checklistConfig.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-2 rounded-md border border-border/50 bg-background/50 p-2 text-xs transition hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={!!checkedItems[item.id]}
                    onChange={(e) =>
                      setCheckedItems((prev) => ({ ...prev, [item.id]: e.target.checked }))
                    }
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border text-primary accent-primary"
                  />
                  <div className="flex flex-col">
                    <span className={cn(checkedItems[item.id] ? "text-foreground" : "font-medium text-amber-500")}>
                      {item.label}
                    </span>
                    {!checkedItems[item.id] && (
                      <button
                        type="button"
                        onClick={() =>
                          setRefineText((prev) => (prev ? `${prev}; ${item.hint}` : item.hint))
                        }
                        className="mt-1 text-[11px] text-primary underline underline-offset-2 hover:opacity-80 text-left"
                      >
                        + Add refine instruction
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* iframe */}
        <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-white">
          {isGenerating && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-full border-2 border-primary/30" />
                  <div className="absolute inset-0 h-10 w-10 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                </div>
                <div className="text-sm font-medium text-foreground">
                  {generationStage === "planning"
                    ? "Planning layout & structure…"
                    : generationStage === "building"
                      ? "Building interactive demo…"
                      : `${demo.provider === "claude" ? "Claude" : "Gemini"} is generating…`}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {generationStage === "planning" && (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      Stage 1 of 2
                    </>
                  )}
                  {generationStage === "building" && (
                    <>
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                      Stage 2 of 2 — this may take 20–40 seconds
                    </>
                  )}
                </div>
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
