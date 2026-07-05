import { useRef, useState } from "react";
import { Upload, FileText, X, AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePitchline } from "@/lib/pitchline/store";
import { parseLeadsCsv, dedupeLeads, type ParseResult } from "@/lib/pitchline/csv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SAMPLE = `business,industry,location,email,website,notes
Cedar & Sage Kitchen,Restaurant,"Austin, TX",hello@cedarsage.com,no,No site yet
NorthPeak Roofing,Home Services,"Denver, CO",info@northpeakroof.com,yes,Old Wix site`;

export function ImportLeadsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { leads, addLeads } = usePitchline();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dupes, setDupes] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = (value: string) => {
    setText(value);
    if (!value.trim()) {
      setResult(null);
      return;
    }
    const parsed = parseLeadsCsv(value);
    const { unique, duplicates } = dedupeLeads(parsed.leads, leads);
    setResult({ ...parsed, leads: unique });
    setDupes(duplicates);
  };

  const onFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => analyze(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const reset = () => {
    setText("");
    setResult(null);
    setDupes(0);
  };

  const doImport = () => {
    if (!result?.leads.length) return;
    addLeads(result.leads);
    toast.success(`Imported ${result.leads.length} lead${result.leads.length === 1 ? "" : "s"}`, {
      description: dupes ? `${dupes} duplicate${dupes === 1 ? "" : "s"} skipped.` : undefined,
    });
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a file or paste rows. Recognized columns: business, industry, location,
            email, website, notes. Header row optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-primary/50"
            >
              <Upload className="h-4 w-4" /> Upload CSV
            </button>
            <button
              onClick={() => analyze(SAMPLE)}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <FileText className="h-4 w-4" /> Load sample
            </button>
            {text && (
              <button
                onClick={reset}
                className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>

          <textarea
            value={text}
            onChange={(e) => analyze(e.target.value)}
            placeholder={"Paste CSV rows here…\n\n" + SAMPLE}
            className="h-44 w-full resize-none rounded-md border border-input bg-input p-3 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus:border-ring"
          />

          {result && (
            <div className="space-y-2 rounded-md border border-border bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-status-won">
                  <Check className="h-4 w-4" /> {result.leads.length} ready to import
                </span>
                {dupes > 0 && (
                  <span className="text-muted-foreground">{dupes} duplicate(s) skipped</span>
                )}
                {result.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-status-lost">
                    <AlertTriangle className="h-4 w-4" /> {result.errors.length} row error(s)
                  </span>
                )}
              </div>
              {result.errors.length > 0 && (
                <ul className="max-h-24 overflow-y-auto text-xs text-muted-foreground">
                  {result.errors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={!result?.leads.length}
            className={cn(
              "rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90",
              !result?.leads.length && "cursor-not-allowed opacity-40",
            )}
          >
            Import {result?.leads.length ? `${result.leads.length} leads` : ""}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
