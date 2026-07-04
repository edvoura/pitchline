import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, Bookmark, Check, X } from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { usePitchline } from "@/lib/pitchline/store";
import {
  MOODS,
  LAYOUT_STYLES,
  TYPOGRAPHY_DIRECTIONS,
  COLOR_DIRECTIONS,
  SECTION_OPTIONS,
  type AnimationIntensity,
  type Template,
} from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates")({
  head: () => ({ meta: [{ title: "Templates — Pitchline" }] }),
  component: TemplatesPage,
});

const blank = (): Template => ({
  id: `tpl_${Date.now()}`,
  name: "",
  description: "",
  mood: "minimal",
  layoutStyle: LAYOUT_STYLES[0],
  typography: TYPOGRAPHY_DIRECTIONS[0],
  colorDirection: COLOR_DIRECTIONS[0],
  animation: "subtle",
  sections: ["Hero", "Features", "CTA"],
});

function TemplatesPage() {
  const { templates, saveTemplate, deleteTemplate } = usePitchline();
  const [editing, setEditing] = useState<Template | null>(null);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Templates"
        subtitle={`${templates.length} reusable direction presets`}
        actions={
          <button
            onClick={() => setEditing(blank())}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New template
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-lg border border-border bg-surface p-4 transition hover:border-primary/40"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t.name}</h3>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditing(t)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-status-lost"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{t.description}</p>
            <div className="mt-auto flex flex-wrap gap-1.5">
              <Tag>{t.mood}</Tag>
              <Tag>{t.colorDirection}</Tag>
              <Tag>{t.animation}</Tag>
              <Tag>{t.sections.length} sections</Tag>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
            No templates yet — create one to speed up recurring lead types.
          </div>
        )}
      </div>

      {editing && (
        <TemplateEditor
          template={editing}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            saveTemplate(t);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px] capitalize text-muted-foreground">
      {children}
    </span>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSave,
}: {
  template: Template;
  onClose: () => void;
  onSave: (t: Template) => void;
}) {
  const [t, setT] = useState<Template>(template);
  const set = <K extends keyof Template>(k: K, v: Template[K]) => setT((p) => ({ ...p, [k]: v }));
  const toggleSection = (s: string) =>
    setT((p) => ({
      ...p,
      sections: p.sections.includes(s)
        ? p.sections.filter((x) => x !== s)
        : [...p.sections, s],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-xl border border-border bg-popover p-5 shadow-2xl animate-slide-up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {template.name ? "Edit template" : "New template"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Row label="Name">
            <input
              value={t.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Restaurant — Warm / Luxury"
              className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm outline-none focus:border-ring"
            />
          </Row>
          <Row label="Description">
            <input
              value={t.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short note on when to use this"
              className="h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm outline-none focus:border-ring"
            />
          </Row>
          <div className="grid grid-cols-2 gap-4">
            <Row label="Mood">
              <Sel value={t.mood} onChange={(v) => set("mood", v)} options={MOODS} />
            </Row>
            <Row label="Animation">
              <Sel
                value={t.animation}
                onChange={(v) => set("animation", v as AnimationIntensity)}
                options={["none", "subtle", "expressive"]}
              />
            </Row>
            <Row label="Layout">
              <Sel value={t.layoutStyle} onChange={(v) => set("layoutStyle", v)} options={LAYOUT_STYLES} />
            </Row>
            <Row label="Typography">
              <Sel value={t.typography} onChange={(v) => set("typography", v)} options={TYPOGRAPHY_DIRECTIONS} />
            </Row>
            <Row label="Color">
              <Sel value={t.colorDirection} onChange={(v) => set("colorDirection", v)} options={COLOR_DIRECTIONS} />
            </Row>
          </div>
          <Row label="Sections">
            <div className="flex flex-wrap gap-1.5">
              {SECTION_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleSection(s)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                    t.sections.includes(s)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </Row>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(t)}
            disabled={!t.name.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Save template
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Sel({
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
      className="h-9 w-full rounded-md border border-input bg-input px-2 text-sm capitalize outline-none focus:border-ring"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
