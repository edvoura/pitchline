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
import { MOCK_LEADS, MOCK_TEMPLATES } from "./mock";
import { compilePrompt, generateDemoHtml } from "./generate";

interface PitchlineState {
  leads: Lead[];
  templates: Template[];
  prompts: Record<string, PromptRecord>;
  demos: Record<string, DemoRecord>;
  activeLeadId: string | null;
}

interface PitchlineContextValue extends PitchlineState {
  setActiveLead: (id: string | null) => void;
  addLeads: (leads: Lead[]) => void;
  addLead: (lead: Lead) => void;
  deleteLead: (id: string) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  setQualification: (ids: string[], q: Qualification) => void;
  setStage: (id: string, stage: Stage) => void;
  savePrompt: (record: PromptRecord) => void;
  compileFor: (leadId: string, d: PromptDirection, provider: PromptRecord["provider"]) => PromptRecord;
  generateDemo: (leadId: string) => DemoRecord | null;
  refineDemo: (leadId: string, instruction: string) => DemoRecord | null;
  markReady: (leadId: string) => void;
  saveTemplate: (t: Template) => void;
  deleteTemplate: (id: string) => void;
}

const STORAGE_KEY = "pitchline:v1";

const PitchlineContext = createContext<PitchlineContextValue | null>(null);

function loadState(): PitchlineState {
  const base: PitchlineState = {
    leads: MOCK_LEADS,
    templates: MOCK_TEMPLATES,
    prompts: {},
    demos: {},
    activeLeadId: null,
  };
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PitchlineState>;
    return {
      leads: parsed.leads?.length ? parsed.leads : base.leads,
      templates: parsed.templates?.length ? parsed.templates : base.templates,
      prompts: parsed.prompts ?? {},
      demos: parsed.demos ?? {},
      activeLeadId: parsed.activeLeadId ?? null,
    };
  } catch {
    return base;
  }
}

export function PitchlineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PitchlineState>(() => loadState());

  // Hydrate from localStorage on the client (SSR renders defaults first).
  useEffect(() => {
    setState(loadState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setActiveLead = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeLeadId: id }));
  }, []);

  const addLeads = useCallback((leads: Lead[]) => {
    if (!leads.length) return;
    setState((s) => ({ ...s, leads: [...leads, ...s.leads] }));
  }, []);

  const addLead = useCallback((lead: Lead) => {
    setState((s) => ({ ...s, leads: [lead, ...s.leads] }));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      leads: s.leads.filter((l) => l.id !== id),
      activeLeadId: s.activeLeadId === id ? null : s.activeLeadId,
    }));
  }, []);

  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const setQualification = useCallback((ids: string[], q: Qualification) => {
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) =>
        ids.includes(l.id)
          ? {
              ...l,
              qualification: q,
              stage:
                q === "qualified" && l.stage === "scraped" ? "qualified" : l.stage,
            }
          : l,
      ),
    }));
  }, []);

  const setStage = useCallback((id: string, stage: Stage) => {
    setState((s) => ({
      ...s,
      leads: s.leads.map((l) =>
        l.id === id
          ? {
              ...l,
              stage,
              dateSent:
                stage === "sent" && !l.dateSent
                  ? new Date().toISOString().slice(0, 10)
                  : l.dateSent,
            }
          : l,
      ),
    }));
  }, []);

  const savePrompt = useCallback((record: PromptRecord) => {
    setState((s) => ({
      ...s,
      prompts: { ...s.prompts, [record.leadId]: record },
    }));
  }, []);

  const compileFor = useCallback<PitchlineContextValue["compileFor"]>(
    (leadId, d, provider) => {
      let record!: PromptRecord;
      setState((s) => {
        const lead = s.leads.find((l) => l.id === leadId);
        const compiled = lead ? compilePrompt(lead, d) : "";
        record = { ...d, leadId, compiled, provider, updatedAt: new Date().toISOString() };
        return { ...s, prompts: { ...s.prompts, [leadId]: record } };
      });
      return record;
    },
    [],
  );

  const generateDemo = useCallback<PitchlineContextValue["generateDemo"]>((leadId) => {
    let out: DemoRecord | null = null;
    setState((s) => {
      const lead = s.leads.find((l) => l.id === leadId);
      const prompt = s.prompts[leadId];
      if (!lead || !prompt) return s;
      const html = generateDemoHtml(lead, prompt, prompt.provider, []);
      out = {
        leadId,
        html,
        provider: prompt.provider,
        refinements: [],
        createdAt: new Date().toISOString(),
        ready: false,
      };
      return {
        ...s,
        demos: { ...s.demos, [leadId]: out },
        leads: s.leads.map((l) =>
          l.id === leadId && (l.stage === "scraped" || l.stage === "qualified")
            ? { ...l, stage: "demo_built" }
            : l,
        ),
      };
    });
    return out;
  }, []);

  const refineDemo = useCallback<PitchlineContextValue["refineDemo"]>(
    (leadId, instruction) => {
      let out: DemoRecord | null = null;
      setState((s) => {
        const lead = s.leads.find((l) => l.id === leadId);
        const prompt = s.prompts[leadId];
        const existing = s.demos[leadId];
        if (!lead || !prompt || !existing) return s;
        const refinements = [...existing.refinements, instruction];
        const html = generateDemoHtml(lead, prompt, prompt.provider, refinements);
        out = { ...existing, html, refinements, createdAt: new Date().toISOString() };
        return { ...s, demos: { ...s.demos, [leadId]: out } };
      });
      return out;
    },
    [],
  );

  const markReady = useCallback((leadId: string) => {
    setState((s) => {
      const demo = s.demos[leadId];
      if (!demo) return s;
      return {
        ...s,
        demos: { ...s.demos, [leadId]: { ...demo, ready: true } },
      };
    });
  }, []);

  const saveTemplate = useCallback((t: Template) => {
    setState((s) => {
      const exists = s.templates.some((x) => x.id === t.id);
      return {
        ...s,
        templates: exists
          ? s.templates.map((x) => (x.id === t.id ? t : x))
          : [...s.templates, t],
      };
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setState((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) }));
  }, []);

  const value = useMemo<PitchlineContextValue>(
    () => ({
      ...state,
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
