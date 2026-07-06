import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Wand2, Sparkles, FileText, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { usePitchline } from "@/lib/pitchline/store";
import {
  MOODS,
  LAYOUT_STYLES,
  TYPOGRAPHY_DIRECTIONS,
  COLOR_DIRECTIONS,
  SECTION_OPTIONS,
  type AnimationIntensity,
  type PromptDirection,
  type Provider,
  type Template,
} from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/generator")({
  head: () => ({ meta: [{ title: "Prompt Generator — Pitchline" }] }),
  component: GeneratorPage,
});

const emptyDirection: PromptDirection = {
  mood: "minimal",
  layoutStyle: LAYOUT_STYLES[0],
  typography: TYPOGRAPHY_DIRECTIONS[0],
  colorDirection: COLOR_DIRECTIONS[0],
  animation: "subtle",
  visualReference: "",
  sections: ["Hero", "Features", "Social Proof", "CTA"],
  ctaFocus: "",
  story: "",
  need: "",
  answer: "",
  proof: "",
};

function GeneratorPage() {
  const {
    leads,
    activeLeadId,
    setActiveLead,
    prompts,
    templates,
    compileFor,
    generateDemo,
  } = usePitchline();
  const navigate = useNavigate();

  const qualified = useMemo(
    () => leads.filter((l) => l.qualification === "qualified"),
    [leads],
  );
  const lead = leads.find((l) => l.id === activeLeadId) ?? null;

  // Switcher lists qualified leads plus the active one (Generate can be run
  // from any row, including not-yet-qualified leads).
  const switchList = useMemo(() => {
    const base = [...qualified];
    if (lead && !base.some((l) => l.id === lead.id)) base.unshift(lead);
    return base;
  }, [qualified, lead]);


  const [dir, setDir] = useState<PromptDirection>(emptyDirection);
  const [provider, setProvider] = useState<Provider>("claude");
  const [compiled, setCompiled] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [availableSections, setAvailableSections] = useState<string[]>(SECTION_OPTIONS);

  // Sync availableSections if custom sections exist in loaded prompt
  useEffect(() => {
    if (dir.sections) {
      const unique = Array.from(new Set([...SECTION_OPTIONS, ...dir.sections]));
      setAvailableSections(unique);
    }
  }, [dir.sections]);

  // Load existing prompt for the active lead
  useEffect(() => {
    if (!activeLeadId) return;
    const existing = prompts[activeLeadId];
    if (existing) {
      setDir(existing);
      setProvider(existing.provider);
      setCompiled(existing.compiled);
    } else {
      setDir(emptyDirection);
      setCompiled(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeadId]);

  const set = <K extends keyof PromptDirection>(k: K, v: PromptDirection[K]) => {
    setDir((d) => ({ ...d, [k]: v }));
    setCompiled(null);
  };

  const toggleSection = (s: string) =>
    setDir((d) => ({
      ...d,
      sections: d.sections.includes(s)
        ? d.sections.filter((x) => x !== s)
        : [...d.sections, s],
    }));

  const applyTemplate = (t: Template) => {
    setDir((d) => ({
      ...d,
      mood: t.mood,
      layoutStyle: t.layoutStyle,
      typography: t.typography,
      colorDirection: t.colorDirection,
      animation: t.animation,
      sections: t.sections,
    }));
    setCompiled(null);
  };

  const doCompile = async () => {
    if (!lead) return;
    const rec = await compileFor(lead.id, dir, provider);
    setCompiled(rec.compiled);
  };

  const doGenerate = async () => {
    if (!lead) return;
    const rec = await compileFor(lead.id, dir, provider);
    generateDemo(lead.id, rec);
    navigate({ to: "/preview" });
  };

  const copy = async () => {
    if (!compiled) return;
    await navigator.clipboard.writeText(compiled);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!lead) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Prompt Generator" subtitle="Pick a qualified lead to begin" />
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-surface">
            <Wand2 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold">No lead selected</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a qualified lead to compile a demo prompt.
          </p>
          <div className="mt-6 space-y-1 rounded-lg border border-border bg-surface p-2 text-left">
            {qualified.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No qualified leads yet — qualify one in the Leads screen.
              </p>
            )}
            {qualified.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveLead(l.id)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="font-medium">{l.business}</span>
                <span className="text-xs text-muted-foreground">
                  {l.industry} · {l.location}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Prompt Generator"
        subtitle={`${lead.business} · ${lead.industry} · ${lead.location}`}
        actions={
          <>
            <LeadSwitcher current={lead.id} leads={switchList} onSelect={setActiveLead} />
            <ProviderToggle value={provider} onChange={(p) => { setProvider(p); setCompiled(null); }} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_minmax(360px,42%)]">
        {/* FORM */}
        <div className="space-y-6 border-r border-border px-6 py-5">
          {/* templates */}
          {templates.length > 0 && (
            <Field label="Apply a template">
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mood">
              <Chips options={MOODS} value={dir.mood} onChange={(v) => set("mood", v)} />
            </Field>
            <Field label="Animation intensity">
              <Chips
                options={["none", "subtle", "expressive"]}
                value={dir.animation}
                onChange={(v) => set("animation", v as AnimationIntensity)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Layout style">
              <SelectInput value={dir.layoutStyle} onChange={(v) => set("layoutStyle", v)} options={LAYOUT_STYLES} />
            </Field>
            <Field label="Typography direction">
              <SelectInput value={dir.typography} onChange={(v) => set("typography", v)} options={TYPOGRAPHY_DIRECTIONS} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Color direction">
              <SelectInput value={dir.colorDirection} onChange={(v) => set("colorDirection", v)} options={COLOR_DIRECTIONS} />
            </Field>
            <Field label="Visual reference">
              <TextInput
                value={dir.visualReference}
                onChange={(v) => set("visualReference", v)}
                placeholder="like Linear but warmer"
              />
            </Field>
          </div>

          <Field label="Sections to include">
            <div className="flex flex-wrap gap-2">
              {availableSections.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSection(s)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    dir.sections.includes(s)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                id="custom-section-input"
                placeholder="Add custom section…"
                className="h-8 w-44 rounded-md border border-input bg-input px-2.5 text-xs outline-none focus:border-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val && !availableSections.includes(val)) {
                      setAvailableSections([...availableSections, val]);
                      toggleSection(val);
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById("custom-section-input") as HTMLInputElement | null;
                  const val = input?.value.trim();
                  if (val && !availableSections.includes(val)) {
                    setAvailableSections([...availableSections, val]);
                    toggleSection(val);
                    if (input) input.value = "";
                  }
                }}
                className="h-8 rounded-md bg-secondary px-3 text-xs font-medium text-foreground hover:bg-secondary/80"
              >
                Add
              </button>
            </div>
          </Field>

          <Field label="Primary CTA focus">
            <TextInput
              value={dir.ctaFocus}
              onChange={(v) => set("ctaFocus", v)}
              placeholder="Book a table / Get a free quote"
            />
          </Field>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="mono text-[11px] uppercase tracking-wider text-primary">SNAP copy</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Story hook">
                <TextInput value={dir.story} onChange={(v) => set("story", v)} placeholder="The opening line" />
              </Field>
              <Field label="Need">
                <TextInput value={dir.need} onChange={(v) => set("need", v)} placeholder="Pain being solved" />
              </Field>
              <Field label="Answer">
                <TextInput value={dir.answer} onChange={(v) => set("answer", v)} placeholder="Your solution" />
              </Field>
              <Field label="Proof point">
                <TextInput value={dir.proof} onChange={(v) => set("proof", v)} placeholder="A testimonial / stat" />
              </Field>
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="flex flex-col px-6 py-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Compiled prompt
            </div>
            <button
              onClick={copy}
              disabled={!compiled}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-status-won" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="min-h-[320px] flex-1 overflow-auto rounded-lg border border-border bg-surface p-4">
            {compiled ? (
              <pre className="mono whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 animate-fade-in">
                {compiled}
              </pre>
            ) : (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-sm text-muted-foreground">
                <Sparkles className="mb-2 h-5 w-5 opacity-50" />
                Fill the direction and hit Compile Prompt.
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={doCompile}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-accent"
            >
              <FileText className="h-4 w-4" /> Compile Prompt
            </button>
            <button
              onClick={doGenerate}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Wand2 className="h-4 w-4" /> Generate Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition",
            value === o
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:text-foreground",
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm outline-none focus:border-ring"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring"
    />
  );
}

function ProviderToggle({
  value,
  onChange,
}: {
  value: Provider;
  onChange: (p: Provider) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-border bg-surface p-0.5 text-xs font-medium">
      {(["claude", "gemini"] as Provider[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "rounded px-3 py-1 capitalize transition",
            value === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function LeadSwitcher({
  current,
  leads,
  onSelect,
}: {
  current: string;
  leads: { id: string; business: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => onSelect(e.target.value)}
        className="h-8 appearance-none rounded-md border border-border bg-surface pl-2.5 pr-7 text-xs outline-none focus:border-ring"
      >
        {leads.map((l) => (
          <option key={l.id} value={l.id}>
            {l.business}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
