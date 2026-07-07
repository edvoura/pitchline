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
  heroStyle: "static",
  story: "",
  need: "",
  answer: "",
  proof: "",
};

function getSnapOptions(industry: string) {
  const ind = (industry || "").toLowerCase();
  
  if (ind.includes("dent") || ind.includes("clinic") || ind.includes("health") || ind.includes("medic")) {
    return {
      story: [
        "We believe premium dental care starts with listening to the patient first.",
        "Your smile is the first thing people notice — it deserves expert, gentle care.",
        "Going to the dentist should be a relaxing experience, not a source of anxiety.",
        "Providing modern, stress-free family dentistry for our local community."
      ],
      need: [
        "Finding a trusted family dentist who prioritizes your comfort can be stressful.",
        "Busy schedules and dental anxiety prevent many from getting essential care.",
        "Outdated clinics and rushed appointments make simple cleanings feel unpleasant."
      ],
      answer: [
        "We offer comprehensive family dentistry in a gentle, warm, and modern environment.",
        "Our state-of-the-art clinic uses advanced pain-free technology for maximum comfort.",
        "Bespoke dental treatments tailored to your schedule, with zero anxiety."
      ],
      proof: [
        "Over 5,000+ smiles created in our modern clinic, backed by 5-star Google ratings.",
        "Equipped with advanced low-radiation digital imaging and comforting amenities.",
        "Our experienced team has over 15 years of combined clinical excellence."
      ]
    };
  }
  
  if (ind.includes("rest") || ind.includes("cafe") || ind.includes("food") || ind.includes("bake") || ind.includes("coffee") || ind.includes("bakery")) {
    return {
      story: [
        "We believe every meal tells a story of organic care, craft, and passion.",
        "Crafting the perfect daily cup of coffee is a ritual we take seriously.",
        "Bringing neighbors together over hand-crafted seasonal recipes.",
        "Traditional baking methods passed down through generations, fresh daily."
      ],
      need: [
        "Finding authentic, scratch-made dining spots using clean ingredients can be tough.",
        "Fast food shouldn't mean sacrificing fresh, vibrant flavor or quality.",
        "In a busy city, finding a cozy sanctuary to unwind with good food is rare."
      ],
      answer: [
        "We serve scratch-made local classics using organic ingredients from local farms.",
        "Our cozy space combines signature artisan coffee with freshly baked pastries.",
        "A carefully curated menu of seasonal dishes served in a relaxed atmosphere."
      ],
      proof: [
        "Voted top local dining experience in the neighborhood with 300+ five-star reviews.",
        "100% locally sourced organic ingredients delivered fresh every single morning.",
        "Proudly serving our signature recipes to happy regulars for over 8 years."
      ]
    };
  }
  
  if (ind.includes("saas") || ind.includes("tech") || ind.includes("soft") || ind.includes("app") || ind.includes("agency") || ind.includes("consult")) {
    return {
      story: [
        "Scaling your business operations shouldn't require hiring a massive team.",
        "We believe technology should work for you, not add to your daily stress.",
        "Modern business teams waste hours every single week on manual, repetitive tasks.",
        "Your digital product should convert visitors, not just look pretty."
      ],
      need: [
        "Fragmented tools and overly complex software end up costing more time than they save.",
        "Finding a technical partner that understands business conversion rates is rare.",
        "Most platforms are built for engineers, leaving operators struggling to execute."
      ],
      answer: [
        "We build clean, high-performance automated pipelines that save 15+ hours weekly.",
        "Our intuitive single-pane dashboard brings all customer touchpoints together.",
        "We design and build custom digital products engineered for high conversion rates."
      ],
      proof: [
        "Helping 150+ high-growth brands scale with an average conversion lift of 35%.",
        "Tested to handle millions of requests with a guaranteed 99.99% uptime record.",
        "Featured in leading tech publications and trusted by enterprise teams globally."
      ]
    };
  }
  
  if (ind.includes("well") || ind.includes("spa") || ind.includes("yoga") || ind.includes("care") || ind.includes("salon") || ind.includes("beauty")) {
    return {
      story: [
        "True wellness isn't a luxury — it's an essential daily practice.",
        "Your mind and body deserve a regular pause from the daily digital noise.",
        "Healthy, glowing skin starts with natural, nourishing organic botanicals.",
        "Bespoke self-care treatments designed to restore your natural balance."
      ],
      need: [
        "Finding a quiet space to truly disconnect and recharge is almost impossible.",
        "Standard salons often rush your treatment, making self-care feel like a chore.",
        "Many modern beauty products use harsh chemicals that irritate instead of healing."
      ],
      answer: [
        "We offer bespoke therapeutic massages and organic facials in a serene sanctuary.",
        "Our holistic wellness programs restore balance, strength, and inner peace.",
        "A premium salon experience focusing on non-toxic, eco-friendly hair and nail care."
      ],
      proof: [
        "Named the top local wellness escape with a 98% client satisfaction rate.",
        "Only 100% certified organic and cruelty-free botanicals are used in our spa.",
        "Our certified therapists have over a decade of experience in holistic healing."
      ]
    };
  }

  // Fallback / General services
  return {
    story: [
      "We believe a clean, organized space is the foundation of a productive life.",
      "Your home is your biggest investment — it deserves professional craftsmanship.",
      "When something breaks in your home, you need a quick, reliable, transparent fix.",
      "Providing top-tier local services built on trust, honesty, and clear pricing."
    ],
    need: [
      "Finding service providers who show up on time and do quality work is a major hassle.",
      "Most contractors charge hidden fees and leave a mess behind when they're done.",
      "Trying to manage complex home tasks yourself wastes your weekend time."
    ],
    answer: [
      "Our premium team uses eco-friendly products to make your space spotless and fresh.",
      "From custom installations to minor repairs, we deliver exceptional craftsmanship.",
      "We provide fully licensed, background-checked local repair and maintenance services."
    ],
    proof: [
      "Backed by a 100% satisfaction guarantee and fully insured for your peace of mind.",
      "Over 800+ homes serviced locally with a perfect track record of reliability.",
      "Same-day response times for emergency calls with transparent, flat-rate pricing."
    ]
  };
}

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

  // Auto-compile prompt on direction/provider/lead changes with 400ms debounce
  useEffect(() => {
    if (!lead) return;
    const delayDebounce = setTimeout(async () => {
      try {
        const rec = await compileFor(lead.id, dir, provider);
        if (rec) setCompiled(rec.compiled);
      } catch (err) {
        console.error("Auto-compile failed:", err);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [dir, provider, lead, compileFor]);

  const set = <K extends keyof PromptDirection>(k: K, v: PromptDirection[K]) => {
    setDir((d) => ({ ...d, [k]: v }));
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

          {/* Brand Intelligence reference (read-only) */}
          {lead && lead.brandSource && lead.brandSource !== 'none' && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Brand Intelligence</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  from {lead.brandSource === 'website' ? 'website' : 'places'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {lead.brandColors?.length ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Colors:</span>
                    {lead.brandColors.map((c, i) => (
                      <span
                        key={i}
                        className="inline-block h-4 w-4 rounded-full border border-border/50"
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                ) : null}
                {lead.brandFonts?.length ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Fonts:</span>
                    {lead.brandFonts.map((f, i) => (
                      <span key={i} className="rounded bg-surface px-1.5 py-0.5 text-[11px] font-medium text-foreground">{f}</span>
                    ))}
                  </div>
                ) : null}
                {lead.brandLogoUrl ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Logo:</span>
                    <img src={lead.brandLogoUrl} alt="brand logo" className="h-5 w-5 rounded object-contain" />
                  </div>
                ) : null}
              </div>
              {lead.brandToneSummary ? (
                <p className="mt-1.5 text-[11px] italic text-muted-foreground">"{lead.brandToneSummary}"</p>
              ) : null}
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">These brand signals will be used automatically in the compiled prompt — they override the color/typography direction below.</p>
            </div>
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

          <Field label="Hero style">
            <Chips
              options={["static", "carousel"]}
              value={dir.heroStyle || "static"}
              onChange={(v) => set("heroStyle", v as "static" | "carousel")}
            />
          </Field>

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
            {(() => {
              const snapOpts = getSnapOptions(lead?.industry || "");
              return (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Story hook">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={snapOpts.story.includes(dir.story) ? dir.story : ""}
                        onChange={(e) => {
                          if (e.target.value) set("story", e.target.value);
                        }}
                        className="w-full rounded-md border border-input bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
                      >
                        <option value="">-- Select realistic Hook Preset --</option>
                        {snapOpts.story.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt.length > 55 ? opt.substring(0, 55) + "..." : opt}
                          </option>
                        ))}
                      </select>
                      <TextInput value={dir.story} onChange={(v) => set("story", v)} placeholder="Or customize opening line here..." />
                    </div>
                  </Field>

                  <Field label="Need">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={snapOpts.need.includes(dir.need) ? dir.need : ""}
                        onChange={(e) => {
                          if (e.target.value) set("need", e.target.value);
                        }}
                        className="w-full rounded-md border border-input bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
                      >
                        <option value="">-- Select realistic Need Preset --</option>
                        {snapOpts.need.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt.length > 55 ? opt.substring(0, 55) + "..." : opt}
                          </option>
                        ))}
                      </select>
                      <TextInput value={dir.need} onChange={(v) => set("need", v)} placeholder="Or customize pain point here..." />
                    </div>
                  </Field>

                  <Field label="Answer">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={snapOpts.answer.includes(dir.answer) ? dir.answer : ""}
                        onChange={(e) => {
                          if (e.target.value) set("answer", e.target.value);
                        }}
                        className="w-full rounded-md border border-input bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
                      >
                        <option value="">-- Select realistic Answer Preset --</option>
                        {snapOpts.answer.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt.length > 55 ? opt.substring(0, 55) + "..." : opt}
                          </option>
                        ))}
                      </select>
                      <TextInput value={dir.answer} onChange={(v) => set("answer", v)} placeholder="Or customize solution here..." />
                    </div>
                  </Field>

                  <Field label="Proof point">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={snapOpts.proof.includes(dir.proof) ? dir.proof : ""}
                        onChange={(e) => {
                          if (e.target.value) set("proof", e.target.value);
                        }}
                        className="w-full rounded-md border border-input bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-ring"
                      >
                        <option value="">-- Select realistic Proof Preset --</option>
                        {snapOpts.proof.map((opt, idx) => (
                          <option key={idx} value={opt}>
                            {opt.length > 55 ? opt.substring(0, 55) + "..." : opt}
                          </option>
                        ))}
                      </select>
                      <TextInput value={dir.proof} onChange={(v) => set("proof", v)} placeholder="Or customize testimonial/stat here..." />
                    </div>
                  </Field>
                </div>
              );
            })()}
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
