import React from "react";
import { cn } from "@/lib/utils";
import type { Settings } from "@/types";

const COLOR_SWATCHES = {
  default: ["#7DD3FC", "#38BDF8", "#60A5FA", "#3B82F6", "#4F46E5", "#6366F1"],
  vivid: ["#22D3EE", "#A78BFA", "#4F8CFF", "#22C55E", "#FACC15", "#F43F5E"],
  heatmap: ["#FF2F6D", "#FF3B3B", "#FF5C1A", "#FF8C1A", "#FFB703"],
};

interface AppearanceSettingsProps {
  settings: Partial<Settings>;
  updateSetting: (key: keyof Settings, value: string) => void;
}

export default function AppearanceSettings({ settings, updateSetting }: AppearanceSettingsProps) {
  const current = settings.appearance || "default";

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Default */}
      <button
        onClick={() => updateSetting("appearance", "default")}
        className={cn(
          "rounded-lg p-3 border-2 transition-all text-left",
          current === "default"
            ? "border-primary bg-card"
            : "border-border bg-secondary hover:border-muted-foreground"
        )}
      >
        <div className="text-sm font-medium mb-2">Default</div>
        <div className="flex gap-1">
          {COLOR_SWATCHES.default.map((color, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Monochromatic gradient
        </div>
      </button>

      {/* Vivid */}
      <button
        onClick={() => updateSetting("appearance", "vivid")}
        className={cn(
          "rounded-lg p-3 border-2 transition-all text-left",
          current === "vivid"
            ? "border-primary bg-card"
            : "border-border bg-secondary hover:border-muted-foreground"
        )}
      >
        <div className="text-sm font-medium mb-2">Vivid</div>
        <div className="flex gap-1">
          {COLOR_SWATCHES.vivid.map((color, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Semantic colors
        </div>
      </button>

      {/* Warm Heatmap */}
      <button
        onClick={() => updateSetting("appearance", "heatmap")}
        className={cn(
          "rounded-lg p-3 border-2 transition-all text-left",
          current === "heatmap"
            ? "border-primary bg-card"
            : "border-border bg-secondary hover:border-muted-foreground"
        )}
      >
        <div className="text-sm font-medium mb-2">Warm Heatmap</div>
        <div className="flex gap-1">
          {COLOR_SWATCHES.heatmap.map((color, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Activity-based warmth
        </div>
      </button>
    </div>
  );
}
