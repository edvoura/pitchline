import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  X,
  ArrowRight,
  Globe,
  MailCheck,
  MailX,
  Mail,
  Search,
  Upload,
  Plus,
  Download,
  Phone,
  MessageCircle,
} from "lucide-react";
import { PageHeader } from "@/components/pitchline/PageHeader";
import { StatusBadge } from "@/components/pitchline/StatusBadge";
import { usePitchline } from "@/lib/pitchline/store";
import { useUI } from "@/lib/pitchline/ui";
import { leadsToCsv, downloadCsv } from "@/lib/pitchline/csv";
import type { Lead, Qualification } from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/leads")({
  head: () => ({ meta: [{ title: "Leads — Pitchline" }] }),
  component: LeadsPage,
});

const qualStyles: Record<Qualification, string> = {
  pending: "text-muted-foreground",
  qualified: "text-status-qualified",
  rejected: "text-status-lost",
};

function EmailFlag({ status }: { status: Lead["emailStatus"] }) {
  if (status === "valid")
    return <MailCheck className="h-4 w-4 text-status-won" aria-label="Valid email" />;
  if (status === "invalid")
    return <MailX className="h-4 w-4 text-status-lost" aria-label="Invalid email" />;
  return <Mail className="h-4 w-4 text-muted-foreground" aria-label="Unknown email" />;
}

function LeadsPage() {
  const { leads, setQualification, setActiveLead } = usePitchline();
  const { setImportOpen, setAddOpen, commandOpen, helpOpen, importOpen, addOpen } = useUI();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("all");
  const [location, setLocation] = useState("all");
  const [qual, setQual] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const industries = useMemo(
    () => Array.from(new Set(leads.map((l) => l.industry))).sort(),
    [leads],
  );
  const locations = useMemo(
    () => Array.from(new Set(leads.map((l) => l.location))).sort(),
    [leads],
  );

  const filtered = useMemo(
    () =>
      leads.filter((l) => {
        if (industry !== "all" && l.industry !== industry) return false;
        if (location !== "all" && l.location !== location) return false;
        if (qual !== "all" && l.qualification !== qual) return false;
        if (q && !`${l.business} ${l.industry} ${l.location}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [leads, industry, location, qual, q],
  );

  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const toggleAll = () =>
    setSelected(allSelected ? [] : filtered.map((l) => l.id));
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulk = (q: Qualification) => {
    if (!selected.length) return;
    setQualification(selected, q);
    setSelected([]);
  };

  const generate = (id: string) => {
    setActiveLead(id);
    navigate({ to: "/generator" });
  };

  const exportCsv = () => {
    const rows = filtered.length ? filtered : leads;
    downloadCsv(`pitchline-leads-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(rows));
    toast.success(`Exported ${rows.length} leads`);
  };

  // Keep the row cursor within bounds when the filtered list changes.
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Row-level keyboard shortcuts: j/k to move, q/x to qualify/reject, Enter to generate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      if (commandOpen || helpOpen || importOpen || addOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!filtered.length) return;

      const key = e.key.toLowerCase();
      const current = filtered[Math.min(cursor, filtered.length - 1)];

      if (key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => {
          const next = Math.min(c + 1, filtered.length - 1);
          rowRefs.current[filtered[next]?.id]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => {
          const next = Math.max(c - 1, 0);
          rowRefs.current[filtered[next]?.id]?.scrollIntoView({ block: "nearest" });
          return next;
        });
      } else if (key === "q" && current) {
        e.preventDefault();
        setQualification([current.id], "qualified");
      } else if (key === "x" && current) {
        e.preventDefault();
        setQualification([current.id], "rejected");
      } else if (e.key === "Enter" && current) {
        e.preventDefault();
        generate(current.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, cursor, commandOpen, helpOpen, importOpen, addOpen]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Leads"
        subtitle={`${filtered.length} of ${leads.length} scraped businesses`}
        actions={
          <>
            <HeaderBtn onClick={() => setImportOpen(true)} icon={Upload} label="Import" />
            <HeaderBtn onClick={exportCsv} icon={Download} label="Export" />
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" /> Add lead
            </button>
          </>
        }
      />


      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="leads-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search leads…  (press /)"
            className="h-8 w-56 rounded-md border border-input bg-input pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
        <Select value={industry} onChange={setIndustry} label="Industry" options={industries} />
        <Select value={location} onChange={setLocation} label="Location" options={locations} />
        <Select
          value={qual}
          onChange={setQual}
          label="Status"
          options={["pending", "qualified", "rejected"]}
        />

        {selected.length > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1 animate-fade-in">
            <span className="mono text-xs text-muted-foreground">
              {selected.length} selected
            </span>
            <button
              onClick={() => bulk("qualified")}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-status-won hover:bg-accent"
            >
              <Check className="h-3.5 w-3.5" /> Qualify
            </button>
            <button
              onClick={() => bulk("rejected")}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-status-lost hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        )}
      </div>

      {/* table */}
      <div className="px-6 py-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-primary"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Business</th>
                <th className="px-3 py-2.5 font-medium">Industry</th>
                <th className="px-3 py-2.5 font-medium">Location</th>
                <th className="px-3 py-2.5 text-center font-medium">Site</th>
                <th className="px-3 py-2.5 text-center font-medium">Brand</th>
                <th className="px-3 py-2.5 text-center font-medium">Email</th>
                <th className="px-3 py-2.5 text-center font-medium">Channel</th>
                <th className="px-3 py-2.5 font-medium">Qualification</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium">Scraped</th>
                <th className="px-3 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l, i) => (
                <tr
                  key={l.id}
                  ref={(el) => {
                    rowRefs.current[l.id] = el;
                  }}
                  onClick={() => setCursor(i)}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-0 hover:bg-surface/60",
                    selected.includes(l.id) && "bg-surface/80",
                    i === cursor && "bg-accent/40 ring-1 ring-inset ring-primary/40",
                    l.preferredChannel === "call" && "opacity-60",
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={() => toggle(l.id)}
                      className="accent-primary"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-foreground">{l.business}</div>
                    <div className="mono text-[11px] text-muted-foreground">{l.email}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.industry}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.location}</td>
                  <td className="px-3 py-2.5 text-center">
                    {l.hasWebsite ? (
                      <Globe className="mx-auto h-4 w-4 text-muted-foreground" aria-label="Has website" />
                    ) : (
                      <span className="mono text-[11px] text-status-qualified">none</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {l.brandSource && l.brandSource !== 'none' && l.brandColors?.length ? (
                      <div className="flex items-center justify-center gap-1" title={`Brand: ${l.brandColors.join(', ')}${l.brandFonts?.length ? ' · ' + l.brandFonts.join(', ') : ''}`}>
                        {l.brandColors.slice(0, 3).map((c, ci) => (
                          <span key={ci} className="inline-block h-3 w-3 rounded-full border border-border/40" style={{ backgroundColor: c }} />
                        ))}
                        <Check className="h-3 w-3 text-status-won" />
                      </div>
                    ) : (
                      <span className="flex justify-center text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      <EmailFlag status={l.emailStatus} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center">
                      {l.preferredChannel === 'whatsapp' && l.whatsappLink ? (
                        <a
                          href={l.whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`WhatsApp: ${l.phone || 'unknown'}`}
                          className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 transition hover:bg-emerald-500/20"
                        >
                          <MessageCircle className="h-3 w-3" />
                          WhatsApp
                        </a>
                      ) : l.preferredChannel === 'call' ? (
                        <span
                          title="No digital contact — manual research needed"
                          className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400"
                        >
                          <Phone className="h-3 w-3" />
                          Call
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <Mail className="h-3 w-3" />
                          Email
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={cn("px-3 py-2.5 text-xs font-medium capitalize", qualStyles[l.qualification])}>
                    {l.qualification}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge stage={l.stage} />
                  </td>
                  <td className="mono px-3 py-2.5 text-xs text-muted-foreground">
                    {l.dateScraped}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {l.qualification !== "qualified" && (
                        <IconBtn
                          onClick={() => setQualification([l.id], "qualified")}
                          title="Qualify"
                          className="hover:text-status-won"
                        >
                          <Check className="h-4 w-4" />
                        </IconBtn>
                      )}
                      {l.qualification !== "rejected" && (
                        <IconBtn
                          onClick={() => setQualification([l.id], "rejected")}
                          title="Reject"
                          className="hover:text-status-lost"
                        >
                          <X className="h-4 w-4" />
                        </IconBtn>
                      )}
                      <button
                        onClick={() => generate(l.id)}
                        className="ml-1 flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
                      >
                        Generate <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No leads match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeaderBtn({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Upload;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-input bg-input px-2 text-sm capitalize outline-none focus:border-ring"
    >
      <option value="all">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o} className="capitalize">
          {o}
        </option>
      ))}
    </select>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}
