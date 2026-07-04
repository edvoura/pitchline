import { STAGES, type Stage } from "@/lib/pitchline/types";
import { cn } from "@/lib/utils";

const stageMap = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<
  Stage,
  (typeof STAGES)[number]
>;

export function StatusBadge({
  stage,
  className,
}: {
  stage: Stage;
  className?: string;
}) {
  const s = stageMap[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: s.token,
        borderColor: `color-mix(in oklab, ${s.token} 35%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${s.token} 12%, transparent)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: s.token }}
      />
      {s.label}
    </span>
  );
}

export function Dot({ token, label }: { token: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: token }} />
      {label}
    </span>
  );
}
