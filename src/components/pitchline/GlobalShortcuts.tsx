import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUI } from "@/lib/pitchline/ui";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { ImportLeadsDialog } from "./ImportLeadsDialog";
import { AddLeadDialog } from "./AddLeadDialog";

const NAV_KEYS: Record<string, string> = {
  "0": "/",
  "1": "/leads",
  "2": "/generator",
  "3": "/preview",
  "4": "/tracker",
  "5": "/templates",
};

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable === true
  );
}

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const {
    commandOpen,
    setCommandOpen,
    helpOpen,
    setHelpOpen,
    importOpen,
    setImportOpen,
    addOpen,
    setAddOpen,
  } = useUI();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Command palette toggle works everywhere, even while typing.
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
        return;
      }

      if (meta || e.altKey) return;
      if (isTyping(e.target)) return;
      // A modal dialog owns the keyboard while open.
      if (commandOpen || helpOpen || importOpen || addOpen) return;

      const key = e.key;

      if (key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      if (key === "/") {
        e.preventDefault();
        navigate({ to: "/leads" }).then(() => {
          setTimeout(() => document.getElementById("leads-search")?.focus(), 40);
        });
        return;
      }

      if (key.toLowerCase() === "i") {
        e.preventDefault();
        setImportOpen(true);
        return;
      }

      if (key.toLowerCase() === "n") {
        e.preventDefault();
        setAddOpen(true);
        return;
      }

      if (NAV_KEYS[key]) {
        e.preventDefault();
        navigate({ to: NAV_KEYS[key] });
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    navigate,
    commandOpen,
    helpOpen,
    importOpen,
    addOpen,
    setCommandOpen,
    setHelpOpen,
    setImportOpen,
    setAddOpen,
  ]);

  return (
    <>
      <CommandPalette />
      <ShortcutsHelp />
      <ImportLeadsDialog open={importOpen} onOpenChange={setImportOpen} />
      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}
