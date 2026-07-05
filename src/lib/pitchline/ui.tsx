import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface UIContextValue {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  importOpen: boolean;
  setImportOpen: (v: boolean) => void;
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const value = useMemo(
    () => ({
      commandOpen,
      setCommandOpen,
      helpOpen,
      setHelpOpen,
      importOpen,
      setImportOpen,
      addOpen,
      setAddOpen,
    }),
    [commandOpen, helpOpen, importOpen, addOpen],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
