import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  DemoRecord,
  Lead,
  PromptDirection,
  PromptRecord,
  Qualification,
  Stage,
  Template,
} from "./types";
import { STARTER_TEMPLATES } from "./mock";
import { compilePrompt, fetchStockImages } from "./generate";
import { supabase } from "../supabase";
import { generateDemoFn } from "./server-fns";
import { generateGeminiDemo } from "../providers/gemini";
import { generateClaudeDemo } from "../providers/claude";
import { toast } from "sonner";

interface PitchlineState {
  leads: Lead[];
  templates: Template[];
  prompts: Record<string, PromptRecord>;
  demos: Record<string, DemoRecord>;
  activeLeadId: string | null;
  generationStage: "planning" | "building" | null;
}

interface PitchlineContextValue extends PitchlineState {
  session: any;
  sessionLoading: boolean;
  user: any;
  signOut: () => Promise<void>;
  setActiveLead: (id: string | null) => void;
  addLeads: (leads: Lead[]) => Promise<void>;
  addLead: (lead: Lead) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  updateLead: (id: string, patch: Partial<Lead>) => Promise<void>;
  setQualification: (ids: string[], q: Qualification) => Promise<void>;
  setStage: (id: string, stage: Stage) => Promise<void>;
  savePrompt: (record: PromptRecord) => Promise<void>;
  compileFor: (
    leadId: string,
    d: PromptDirection,
    provider: PromptRecord["provider"],
  ) => Promise<PromptRecord>;
  generateDemo: (
    leadId: string,
    passedPrompt?: PromptRecord,
    screenshotBase64?: string | null,
  ) => Promise<DemoRecord | null>;
  refineDemo: (
    leadId: string,
    instruction: string,
    screenshotBase64?: string | null,
  ) => Promise<DemoRecord | null>;
  markReady: (leadId: string) => Promise<void>;
  saveTemplate: (t: Template) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

const PitchlineContext = createContext<PitchlineContextValue | null>(null);

// Mapper Helpers: Frontend type <-> Database snake_case columns
function mapLeadFromDb(db: any): Lead {
  return {
    id: db.id,
    business: db.business,
    industry: db.industry,
    location: db.location,
    email: db.email || "",
    hasWebsite: !!db.has_website,
    emailStatus: db.email_status || "unknown",
    qualification: db.qualification || "pending",
    stage: db.stage || "scraped",
    dateScraped: db.date_scraped || "",
    dateSent: db.date_sent || undefined,
    notes: db.notes || "",
    followUp: db.follow_up || undefined,
    source: db.source || "manual",
    sourcePlaceId: db.source_place_id || null,
    rawScrape: db.raw_scrape || null,
    phone: db.phone || null,
    preferredChannel: db.preferred_channel || "email",
    whatsappLink: db.whatsapp_link || null,
    brandColors: db.brand_colors || null,
    brandLogoUrl: db.brand_logo_url || null,
    brandFonts: db.brand_fonts || null,
    brandToneSummary: db.brand_tone_summary || null,
    brandSource: db.brand_source || 'none',
  };
}

function mapLeadToDb(l: Partial<Lead>): any {
  const out: any = {};
  if (l.id !== undefined) out.id = l.id;
  if (l.business !== undefined) out.business = l.business;
  if (l.industry !== undefined) out.industry = l.industry;
  if (l.location !== undefined) out.location = l.location;
  if (l.email !== undefined) out.email = l.email;
  if (l.hasWebsite !== undefined) out.has_website = l.hasWebsite;
  if (l.emailStatus !== undefined) out.email_status = l.emailStatus;
  if (l.qualification !== undefined) out.qualification = l.qualification;
  if (l.stage !== undefined) out.stage = l.stage;
  if (l.dateScraped !== undefined) out.date_scraped = l.dateScraped;
  if (l.dateSent !== undefined) out.date_sent = l.dateSent;
  if (l.notes !== undefined) out.notes = l.notes;
  if (l.followUp !== undefined) out.follow_up = l.followUp;
  if (l.source !== undefined) out.source = l.source;
  if (l.sourcePlaceId !== undefined) out.source_place_id = l.sourcePlaceId;
  if (l.rawScrape !== undefined) out.raw_scrape = l.rawScrape;
  if (l.phone !== undefined) out.phone = l.phone;
  if (l.preferredChannel !== undefined) out.preferred_channel = l.preferredChannel;
  if (l.whatsappLink !== undefined) out.whatsapp_link = l.whatsappLink;
  if (l.brandColors !== undefined) out.brand_colors = l.brandColors;
  if (l.brandLogoUrl !== undefined) out.brand_logo_url = l.brandLogoUrl;
  if (l.brandFonts !== undefined) out.brand_fonts = l.brandFonts;
  if (l.brandToneSummary !== undefined) out.brand_tone_summary = l.brandToneSummary;
  if (l.brandSource !== undefined) out.brand_source = l.brandSource;
  return out;
}

function mapPromptFromDb(db: any): PromptRecord {
  return {
    leadId: db.lead_id,
    mood: db.mood,
    layoutStyle: db.layout_style,
    typography: db.typography,
    colorDirection: db.color_direction,
    animation: db.animation,
    visualReference: db.visual_reference || "",
    sections: db.sections || [],
    ctaFocus: db.cta_focus || "",
    heroStyle: db.hero_style || "static",
    story: db.story || "",
    need: db.need || "",
    answer: db.answer || "",
    proof: db.proof || "",
    compiled: db.compiled,
    provider: db.provider,
    updatedAt: db.updated_at,
  };
}

function mapPromptToDb(p: PromptRecord): any {
  return {
    lead_id: p.leadId,
    mood: p.mood,
    layout_style: p.layoutStyle,
    typography: p.typography,
    color_direction: p.colorDirection,
    animation: p.animation,
    visual_reference: p.visualReference,
    sections: p.sections,
    cta_focus: p.ctaFocus,
    hero_style: p.heroStyle || "static",
    story: p.story,
    need: p.need,
    answer: p.answer,
    proof: p.proof,
    compiled: p.compiled,
    provider: p.provider,
    updated_at: p.updatedAt,
  };
}

function mapDemoFromDb(db: any): DemoRecord {
  return {
    leadId: db.lead_id,
    html: db.html,
    provider: db.provider,
    refinements: db.refinements || [],
    createdAt: db.created_at,
    ready: !!db.ready,
    tokensUsed: db.tokens_used || null,
    generationMs: db.generation_ms || null,
    publicSlug: db.public_slug || null,
  };
}

function mapDemoToDb(d: DemoRecord): any {
  return {
    lead_id: d.leadId,
    html: d.html,
    provider: d.provider,
    refinements: d.refinements,
    created_at: d.createdAt,
    ready: d.ready,
    tokens_used: d.tokensUsed,
    generation_ms: d.generationMs,
    // NOTE: public_slug excluded until migration 20260707_demos_public_slug.sql is run
  };
}

function mapTemplateFromDb(db: any): Template {
  return {
    id: db.id,
    name: db.name,
    description: db.description || "",
    mood: db.mood,
    layoutStyle: db.layout_style,
    typography: db.typography,
    colorDirection: db.color_direction,
    animation: db.animation,
    sections: db.sections || [],
  };
}

function mapTemplateToDb(t: Template): any {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    mood: t.mood,
    layout_style: t.layoutStyle,
    typography: t.typography,
    color_direction: t.colorDirection,
    animation: t.animation,
    sections: t.sections,
  };
}

export function PitchlineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PitchlineState>({
    leads: [],
    templates: [],
    prompts: {},
    demos: {},
    activeLeadId: typeof window !== "undefined" ? (() => { try { return localStorage.getItem("pitchline_active_lead_id"); } catch { return null; } })() : null,
    generationStage: null,
  });

  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const user = session?.user ?? null;

  // Sync auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoading(false);
    }).catch(() => {
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Load from Supabase when session becomes active
  useEffect(() => {
    if (!session) {
      // Only clear data on genuine logout, not during initial session check
      if (!sessionLoading) {
        setState((s) => ({ ...s, leads: [], templates: [], prompts: {}, demos: {} }));
      }
      return;
    }

    async function loadData() {
      try {
        const [leadsRes, templatesRes, promptsRes, demosRes] = await Promise.all([
          supabase.from("leads").select("*"),
          supabase.from("templates").select("*").order("name"),
          supabase.from("prompts").select("*"),
          supabase.from("demos").select("*"),
        ]);

        let dbLeads = (leadsRes.data || []).map(mapLeadFromDb);
        let dbTemplates = (templatesRes.data || []).map(mapTemplateFromDb);


        if (dbTemplates.length === 0) {
          const { data } = await supabase
            .from("templates")
            .insert(STARTER_TEMPLATES.map(mapTemplateToDb))
            .select();
          if (data) dbTemplates = data.map(mapTemplateFromDb);
        }

        const dbPrompts: Record<string, PromptRecord> = {};
        (promptsRes.data || []).forEach((row: any) => {
          dbPrompts[row.lead_id] = mapPromptFromDb(row);
        });

        const dbDemos: Record<string, DemoRecord> = {};
        (demosRes.data || []).forEach((row: any) => {
          dbDemos[row.lead_id] = mapDemoFromDb(row);
        });

        setState((s) => ({
          ...s,
          leads: dbLeads,
          templates: dbTemplates,
          prompts: dbPrompts,
          demos: dbDemos,
        }));
      } catch (err) {
        console.error("Failed to load data from Supabase:", err);
      }
    }
    loadData();
  }, [session, sessionLoading]);

  const setActiveLead = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeLeadId: id }));
    try {
      if (id) {
        localStorage.setItem("pitchline_active_lead_id", id);
      } else {
        localStorage.removeItem("pitchline_active_lead_id");
      }
    } catch { /* sandboxed context — ignore */ }
  }, []);

  const addLeads = useCallback(async (leads: Lead[]) => {
    if (!leads.length) return;
    try {
      await supabase.from("leads").insert(leads.map(mapLeadToDb));
      setState((s) => ({ ...s, leads: [...leads, ...s.leads] }));
    } catch (err) {
      console.error("Error adding leads to Supabase:", err);
    }
  }, []);

  const addLead = useCallback(async (lead: Lead) => {
    try {
      await supabase.from("leads").insert(mapLeadToDb(lead));
      setState((s) => ({ ...s, leads: [lead, ...s.leads] }));
    } catch (err) {
      console.error("Error adding lead to Supabase:", err);
    }
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    try {
      await supabase.from("leads").delete().eq("id", id);
      setState((s) => ({
        ...s,
        leads: s.leads.filter((l) => l.id !== id),
        activeLeadId: s.activeLeadId === id ? null : s.activeLeadId,
      }));
    } catch (err) {
      console.error("Error deleting lead from Supabase:", err);
    }
  }, []);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    try {
      // optimistic update
      setState((s) => ({
        ...s,
        leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }));
      await supabase.from("leads").update(mapLeadToDb(patch)).eq("id", id);
    } catch (err) {
      console.error("Error updating lead in Supabase:", err);
    }
  }, []);

  const setQualification = useCallback(
    async (ids: string[], q: Qualification) => {
      try {
        setState((s) => ({
          ...s,
          leads: s.leads.map((l) =>
            ids.includes(l.id)
              ? {
                  ...l,
                  qualification: q,
                  stage:
                    q === "qualified" && l.stage === "scraped"
                      ? "qualified"
                      : l.stage,
                }
              : l,
          ),
        }));

        await Promise.all(
          ids.map(async (id) => {
            const lead = state.leads.find((l) => l.id === id);
            const stage =
              q === "qualified" && lead?.stage === "scraped"
                ? "qualified"
                : lead?.stage;
            await supabase
              .from("leads")
              .update({ qualification: q, stage })
              .eq("id", id);
          }),
        );
      } catch (err) {
        console.error("Error setting qualification in Supabase:", err);
      }
    },
    [state.leads],
  );

  const setStage = useCallback(
    async (id: string, stage: Stage) => {
      try {
        const lead = state.leads.find((l) => l.id === id);
        const dateSent =
          stage === "sent" && !lead?.dateSent
            ? new Date().toISOString().slice(0, 10)
            : lead?.dateSent;

        setState((s) => ({
          ...s,
          leads: s.leads.map((l) =>
            l.id === id ? { ...l, stage, dateSent } : l,
          ),
        }));

        await supabase
          .from("leads")
          .update({ stage, date_sent: dateSent })
          .eq("id", id);
      } catch (err) {
        console.error("Error setting stage in Supabase:", err);
      }
    },
    [state.leads],
  );

  const savePrompt = useCallback(async (record: PromptRecord) => {
    try {
      setState((s) => ({
        ...s,
        prompts: { ...s.prompts, [record.leadId]: record },
      }));
      await supabase.from("prompts").upsert(mapPromptToDb(record));
    } catch (err) {
      console.error("Error saving prompt to Supabase:", err);
    }
  }, []);

  const compileFor = useCallback<PitchlineContextValue["compileFor"]>(
    async (leadId, d, provider) => {
      const lead = state.leads.find((l) => l.id === leadId);
      let images: string[] = [];
      if (lead) {
        images = await fetchStockImages(lead.industry, d.mood);
      }
      const compiled = lead ? compilePrompt(lead, d, images) : "";
      const record: PromptRecord = {
        ...d,
        leadId,
        compiled,
        provider,
        updatedAt: new Date().toISOString(),
      };

      setState((s) => ({
        ...s,
        prompts: { ...s.prompts, [leadId]: record },
      }));

      try {
        await supabase.from("prompts").upsert(mapPromptToDb(record));
      } catch (err) {
        console.error("Error saving compiled prompt to Supabase:", err);
      }

      return record;
    },
    [state.leads],
  );

  const generateDemo = useCallback<PitchlineContextValue["generateDemo"]>(
    async (leadId, passedPrompt, screenshotBase64) => {
      const lead = state.leads.find((l) => l.id === leadId);
      const prompt = passedPrompt || state.prompts[leadId];
      if (!lead || !prompt) return null;

      // Optimistic update so the preview screen shows a loading spinner immediately
      const existingDemo = state.demos[leadId];
      const tempDemo: DemoRecord = {
        leadId,
        html: "<!-- generating -->",
        provider: prompt.provider,
        refinements: [],
        createdAt: new Date().toISOString(),
        ready: false,
        publicSlug: existingDemo?.publicSlug || Math.random().toString(36).substring(2, 10),
      };

      setState((s) => ({
        ...s,
        demos: { ...s.demos, [leadId]: tempDemo },
        leads: s.leads.map((l) =>
          l.id === leadId && (l.stage === "scraped" || l.stage === "qualified")
            ? { ...l, stage: "demo_built" }
            : l,
        ),
      }));

      try {
        let result;
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
        // Auto-fallback: use the requested provider if its key exists, otherwise use whichever key is available
        let effectiveProvider = prompt.provider;
        if (effectiveProvider === "claude" && !claudeKey && geminiKey) {
          console.warn("[Pitchline] Claude key missing, falling back to Gemini");
          effectiveProvider = "gemini";
        } else if (effectiveProvider === "gemini" && !geminiKey && claudeKey) {
          console.warn("[Pitchline] Gemini key missing, falling back to Claude");
          effectiveProvider = "claude";
        }
        const clientKey = effectiveProvider === "claude" ? claudeKey : geminiKey;

        if (clientKey) {
          console.log(`[Pitchline] Running client-side generation using ${effectiveProvider}...`);
          const onStageChange = (stage: "planning" | "building") => {
            setState((s) => ({ ...s, generationStage: stage }));
          };
          // Append a unique seed so each generation produces a genuinely different design variation
          const seed = `\n\nGENERATION SEED (use this to inspire a unique design variation — do NOT output this seed): ${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const promptWithSeed = prompt.compiled + seed;
          try {
            if (effectiveProvider === "claude") {
              result = await generateClaudeDemo(promptWithSeed, null, [], screenshotBase64, onStageChange);
            } else {
              result = await generateGeminiDemo(promptWithSeed, null, [], screenshotBase64, onStageChange);
            }
          } catch (providerErr) {
            // Auto-fallback to other provider on 429 / quota errors
            const errMsg = providerErr instanceof Error ? providerErr.message : String(providerErr);
            if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
              const fallback = effectiveProvider === "gemini" ? "claude" : "gemini";
              const fallbackKey = fallback === "claude" ? claudeKey : geminiKey;
              if (fallbackKey) {
                console.warn(`[Pitchline] ${effectiveProvider} rate-limited, falling back to ${fallback}...`);
                toast.info(`${effectiveProvider} quota exceeded — retrying with ${fallback}...`);
                if (fallback === "claude") {
                  result = await generateClaudeDemo(promptWithSeed, null, [], screenshotBase64, onStageChange);
                } else {
                  result = await generateGeminiDemo(promptWithSeed, null, [], screenshotBase64, onStageChange);
                }
              } else {
                throw providerErr; // No fallback key available
              }
            } else {
              throw providerErr; // Non-rate-limit error, don't fallback
            }
          }
        } else {
          console.log("[Pitchline] Running server-side generation...");
          result = await generateDemoFn({
            data: {
              compiledPrompt: prompt.compiled,
              provider: prompt.provider,
              refinements: [],
              screenshotBase64,
            }
          });
        }

        const newDemo: DemoRecord = {
          leadId,
          html: result.html,
          provider: prompt.provider,
          refinements: [],
          createdAt: new Date().toISOString(),
          ready: false,
          tokensUsed: result.tokensUsed,
          generationMs: result.generationMs,
          publicSlug: existingDemo?.publicSlug || tempDemo.publicSlug,
        };

        const [demoRes, leadRes] = await Promise.all([
          supabase.from("demos").upsert(mapDemoToDb(newDemo)),
          supabase
            .from("leads")
            .update({ stage: "demo_built" })
            .eq("id", leadId),
        ]);
        if (demoRes.error) console.error("[Pitchline] Demo upsert failed:", demoRes.error.message);
        if (leadRes.error) console.error("[Pitchline] Lead stage update failed:", leadRes.error.message);

        setState((s) => ({
          ...s,
          demos: { ...s.demos, [leadId]: newDemo },
          leads: s.leads.map((l) =>
            l.id === leadId ? { ...l, stage: "demo_built" } : l,
          ),
          generationStage: null,
        }));

        return newDemo;
      } catch (err) {
        // Rollback optimistic update
        setState((s) => {
          const nextDemos = { ...s.demos };
          delete nextDemos[leadId];
          return {
            ...s,
            demos: nextDemos,
            leads: s.leads.map((l) =>
              l.id === leadId ? { ...l, stage: lead.stage } : l,
            ),
            generationStage: null,
          };
        });
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Generation Failed: ${errorMsg}`);
        console.error("Error generating demo HTML:", err);
        throw err;
      }
    },
    [state.leads, state.prompts],
  );



  const refineDemo = useCallback<PitchlineContextValue["refineDemo"]>(
    async (leadId, instruction, screenshotBase64) => {
      const lead = state.leads.find((l) => l.id === leadId);
      const prompt = state.prompts[leadId];
      const existing = state.demos[leadId];
      if (!lead || !prompt || !existing) return null;

      const refinements = [...existing.refinements, instruction];

      try {
        let result;
        const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const claudeKey = import.meta.env.VITE_CLAUDE_API_KEY;
        let effectiveProvider = prompt.provider;
        if (effectiveProvider === "claude" && !claudeKey && geminiKey) {
          effectiveProvider = "gemini";
        } else if (effectiveProvider === "gemini" && !geminiKey && claudeKey) {
          effectiveProvider = "claude";
        }
        const clientKey = effectiveProvider === "claude" ? claudeKey : geminiKey;

        if (clientKey) {
          console.log(`[Pitchline] Running client-side refinement using ${effectiveProvider}...`);
          const onStageChange = (stage: "planning" | "building") => {
            setState((s) => ({ ...s, generationStage: stage }));
          };
          if (effectiveProvider === "claude") {
            result = await generateClaudeDemo(prompt.compiled, existing.html, refinements, screenshotBase64, onStageChange);
          } else {
            result = await generateGeminiDemo(prompt.compiled, existing.html, refinements, screenshotBase64, onStageChange);
          }
        } else {
          console.log("[Pitchline] Running server-side refinement...");
          result = await generateDemoFn({
            data: {
              compiledPrompt: prompt.compiled,
              provider: prompt.provider,
              refinements,
              currentHtml: existing.html,
              screenshotBase64,
            }
          });
        }

        const newDemo: DemoRecord = {
          ...existing,
          html: result.html,
          refinements,
          createdAt: new Date().toISOString(),
          tokensUsed: (existing.tokensUsed || 0) + (result.tokensUsed || 0),
          generationMs: (existing.generationMs || 0) + (result.generationMs || 0),
        };

        const { error: upsertErr } = await supabase.from("demos").upsert(mapDemoToDb(newDemo));
        if (upsertErr) console.error("[Pitchline] Refine upsert failed:", upsertErr.message);

        setState((s) => ({
          ...s,
          demos: { ...s.demos, [leadId]: newDemo },
          generationStage: null,
        }));

        return newDemo;
      } catch (err) {
        setState((s) => ({ ...s, generationStage: null }));
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Refinement Failed: ${errorMsg}`);
        console.error("Error refining demo HTML:", err);
        throw err;
      }
    },
    [state.leads, state.prompts, state.demos],
  );

  const markReady = useCallback(async (leadId: string) => {
    try {
      setState((s) => {
        const demo = s.demos[leadId];
        if (!demo) return s;
        return {
          ...s,
          demos: { ...s.demos, [leadId]: { ...demo, ready: true } },
        };
      });
      await supabase.from("demos").update({ ready: true }).eq("lead_id", leadId);
    } catch (err) {
      console.error("Error marking demo ready in Supabase:", err);
    }
  }, []);

  const saveTemplate = useCallback(async (t: Template) => {
    try {
      const exists = state.templates.some((x) => x.id === t.id);
      setState((s) => ({
        ...s,
        templates: exists
          ? s.templates.map((x) => (x.id === t.id ? t : x))
          : [...s.templates, t],
      }));
      await supabase.from("templates").upsert(mapTemplateToDb(t));
    } catch (err) {
      console.error("Error saving template to Supabase:", err);
    }
  }, [state.templates]);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      setState((s) => ({
        ...s,
        templates: s.templates.filter((t) => t.id !== id),
      }));
      await supabase.from("templates").delete().eq("id", id);
    } catch (err) {
      console.error("Error deleting template from Supabase:", err);
    }
  }, []);

  const value = useMemo<PitchlineContextValue>(
    () => ({
      ...state,
      session,
      sessionLoading,
      user,
      signOut,
      setActiveLead,
      addLeads,
      addLead,
      deleteLead,
      updateLead,
      setQualification,
      setStage,
      savePrompt,
      compileFor,
      generateDemo,
      refineDemo,
      markReady,
      saveTemplate,
      deleteTemplate,
    }),
    [
      state,
      session,
      sessionLoading,
      user,
      signOut,
      setActiveLead,
      addLeads,
      addLead,
      deleteLead,
      updateLead,
      setQualification,
      setStage,
      savePrompt,
      compileFor,
      generateDemo,
      refineDemo,
      markReady,
      saveTemplate,
      deleteTemplate,
    ],
  );

  return <PitchlineContext.Provider value={value}>{children}</PitchlineContext.Provider>;
}

export function usePitchline() {
  const ctx = useContext(PitchlineContext);
  if (!ctx) throw new Error("usePitchline must be used within PitchlineProvider");
  return ctx;
}
