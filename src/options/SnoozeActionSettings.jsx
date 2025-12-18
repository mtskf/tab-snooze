import React from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import ShortcutEditor from "./ShortcutEditor";
import { DEFAULT_SHORTCUTS } from "@/utils/constants";

export default function SnoozeActionSettings({
  settings,
  updateSetting,
  appearance = "default",
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2 mt-4">
        <span className="text-xs text-muted-foreground font-medium">
          Snooze Actions
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (confirm("Reset all shortcuts to default?")) {
              updateSetting("shortcuts", DEFAULT_SHORTCUTS);
            }
          }}
        >
          <RotateCcw className="mr-1.5 h-3 w-3" />
          Reset default
        </Button>
      </div>

      <ShortcutEditor
        shortcuts={{ ...DEFAULT_SHORTCUTS, ...settings.shortcuts }}
        onUpdate={(newShortcuts) => updateSetting("shortcuts", newShortcuts)}
        appearance={appearance}
      />
    </div>
  );
}
