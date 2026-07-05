import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePitchline } from "@/lib/pitchline/store";
import type { Lead } from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const empty = {
  business: "",
  industry: "",
  location: "",
  email: "",
  hasWebsite: false,
  notes: "",
};

export function AddLeadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addLead } = usePitchline();
  const [form, setForm] = useState({ ...empty });

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const reset = () => setForm({ ...empty });

  const save = () => {
    if (!form.business.trim()) {
      toast.error("Business name is required.");
      return;
    }
    const email = form.email.trim();
    const lead: Lead = {
      id: `ld_${Math.random().toString(36).slice(2, 9)}`,
      business: form.business.trim(),
      industry: form.industry.trim() || "Uncategorized",
      location: form.location.trim() || "—",
      email,
      hasWebsite: form.hasWebsite,
      emailStatus: email ? (EMAIL_RE.test(email) ? "valid" : "invalid") : "unknown",
      qualification: "pending",
      stage: "scraped",
      dateScraped: new Date().toISOString().slice(0, 10),
      notes: form.notes.trim(),
    };
    addLead(lead);
    toast.success(`Added ${lead.business}`);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>Manually add a single business to the pipeline.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <L label="Business name *">
            <Inp value={form.business} onChange={(v) => set("business", v)} placeholder="Cedar & Sage Kitchen" autoFocus />
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Industry">
              <Inp value={form.industry} onChange={(v) => set("industry", v)} placeholder="Restaurant" />
            </L>
            <L label="Location">
              <Inp value={form.location} onChange={(v) => set("location", v)} placeholder="Austin, TX" />
            </L>
          </div>
          <L label="Email">
            <Inp value={form.email} onChange={(v) => set("email", v)} placeholder="hello@business.com" />
          </L>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hasWebsite}
              onChange={(e) => set("hasWebsite", e.target.checked)}
              className="accent-primary"
            />
            Has an existing website
          </label>
          <L label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything worth remembering…"
              className="h-20 w-full resize-none rounded-md border border-input bg-input p-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring"
            />
          </L>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Add lead
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-input px-2.5 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-ring",
      )}
    />
  );
}
