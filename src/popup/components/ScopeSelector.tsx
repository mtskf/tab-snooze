import React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Kbd } from "@/components/ui/kbd";
import { Album, AppWindow } from "lucide-react";
import { cn } from "@/lib/utils";

export type Scope = "selected" | "window";

interface ScopeSelectorProps {
  scope: Scope;
  setScope: (scope: Scope) => void;
}

export function ScopeSelector({ scope, setScope }: ScopeSelectorProps) {
  return (
    <RadioGroup
      value={scope}
      onValueChange={(value) => setScope(value as Scope)}
      className="grid grid-cols-2 gap-3"
    >
      <label
        className={cn(
          "cursor-pointer rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border-2 transition-all hover:bg-secondary",
          scope === "selected"
            ? "border-primary bg-accent/10"
            : "border-transparent bg-secondary/50"
        )}
      >
        <div
          className={cn(
            "rounded-md p-2 text-white shadow-sm transition-colors",
            scope === "selected"
              ? "bg-gradient-to-br from-blue-600 to-cyan-500"
              : "bg-gradient-to-br from-slate-600 to-zinc-500 opacity-50 grayscale"
          )}
        >
          <Album className="h-5 w-5" />
        </div>
        <span className="font-medium">Selected tabs</span>
        <Kbd>◀︎</Kbd>
        <RadioGroupItem
          value="selected"
          id="scope-selected"
          className="sr-only"
        />
      </label>

      <label
        className={cn(
          "cursor-pointer rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border-2 transition-all hover:bg-secondary",
          scope === "window"
            ? "border-primary bg-accent/10"
            : "border-transparent bg-secondary/50"
        )}
      >
        <div
          className={cn(
            "rounded-md p-2 text-white shadow-sm transition-colors",
            scope === "window"
              ? "bg-gradient-to-br from-blue-600 to-cyan-500"
              : "bg-gradient-to-br from-slate-600 to-zinc-500 opacity-50 grayscale"
          )}
        >
          <AppWindow className="h-5 w-5" />
        </div>
        <span className="font-medium">Window</span>
        <div className="flex gap-1 items-center">
          <Kbd>▶︎</Kbd>
          <span className="text-[10px] text-muted-foreground">or</span>
          <Kbd>Hold ⇧</Kbd>
        </div>
        <RadioGroupItem value="window" id="scope-window" className="sr-only" />
      </label>
    </RadioGroup>
  );
}
