import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LayoutList,
  SlidersHorizontal,
  MonitorPlay,
  KanbanSquare,
  Bookmark,
  Upload,
  Plus,
  Download,
  Keyboard,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { useUI } from "@/lib/pitchline/ui";
import { usePitchline } from "@/lib/pitchline/store";
import { leadsToCsv, downloadCsv } from "@/lib/pitchline/csv";
import { toast } from "sonner";

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandOpen, setCommandOpen, setImportOpen, setAddOpen, setHelpOpen } = useUI();
  const { leads } = usePitchline();

  const run = (fn: () => void) => {
    setCommandOpen(false);
    // Defer so the dialog closes before navigation/other dialogs open.
    setTimeout(fn, 0);
  };

  const exportCsv = () => {
    downloadCsv(`pitchline-leads-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(leads));
    toast.success(`Exported ${leads.length} leads`);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate({ to: "/leads" }))}>
            <LayoutList /> Leads <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/generator" }))}>
            <SlidersHorizontal /> Prompt Generator <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/preview" }))}>
            <MonitorPlay /> Demo Preview <CommandShortcut>3</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/tracker" }))}>
            <KanbanSquare /> Demo Tracker <CommandShortcut>4</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ to: "/templates" }))}>
            <Bookmark /> Templates <CommandShortcut>5</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => setImportOpen(true))}>
            <Upload /> Import leads from CSV <CommandShortcut>I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setAddOpen(true))}>
            <Plus /> Add a lead <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(exportCsv)}>
            <Download /> Export leads to CSV
          </CommandItem>
          <CommandItem onSelect={() => run(() => setHelpOpen(true))}>
            <Keyboard /> Keyboard shortcuts <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
