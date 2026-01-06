import React from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  SNOOZE_ACTIONS,
  DEFAULT_COLORS,
  VIVID_COLORS,
  HEATMAP_COLORS,
} from "@/utils/constants";
import {
  Clock,
  Moon,
  Sun,
  Armchair,
  Briefcase,
  CalendarDays,
  CalendarRange,
  Archive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ColorScheme = Record<string, string>;

// Icon mapping for each action (matches Popup)
const ACTION_ICONS: Record<string, LucideIcon> = {
  "later-today": Clock,
  "this-evening": Moon,
  tomorrow: Sun,
  "this-weekend": Armchair,
  "next-monday": Briefcase,
  "in-a-week": CalendarRange,
  "in-a-month": Archive,
  "pick-date": CalendarDays,
};

interface ShortcutEditorProps {
  shortcuts: Record<string, string[]>;
  onUpdate: (newShortcuts: Record<string, string[]>) => void;
  appearance?: "default" | "vivid" | "heatmap";
}

interface SnoozeAction {
  id: string;
  label: string;
}

export default function ShortcutEditor({
  shortcuts,
  onUpdate,
  appearance = "default",
}: ShortcutEditorProps) {
  let colorScheme: ColorScheme = DEFAULT_COLORS;
  if (appearance === "vivid") colorScheme = VIVID_COLORS;
  if (appearance === "heatmap") colorScheme = HEATMAP_COLORS;

  const handleChange = (actionId: string, value: string) => {
    // Validation: Single char only, uppercase
    let char = value.slice(-1).toUpperCase(); // Take last char if multiple typed

    // Printable ASCII only (space to tilde, codes 32-126)
    if (char.length !== 1 || char.charCodeAt(0) < 32 || char.charCodeAt(0) > 126) {
      char = "";
    }

    // Check for duplicates (only if char is valid)
    if (char) {
      const existingAction = Object.entries(shortcuts).find(
        ([id, keys]) => id !== actionId && keys.some(k => k.toUpperCase() === char)
      );
      if (existingAction) {
        const actionLabel = SNOOZE_ACTIONS.find(a => a.id === existingAction[0])?.label || existingAction[0];
        toast.warning(`"${char}" is already assigned to "${actionLabel}"`);
        return; // Don't update, keep current value
      }
    }

    const newShortcuts = {
      ...shortcuts,
      [actionId]: char ? [char] : [],
    };

    onUpdate(newShortcuts);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Block modifiers and non-character keys
    if (e.key.length > 1 && e.key !== "Backspace" && e.key !== "Delete") {
      e.preventDefault();
    }
  };

  const renderActionRow = (action: SnoozeAction) => {
    const keys = shortcuts[action.id] || [];
    const Icon = ACTION_ICONS[action.id] || CalendarDays;
    const iconColor = colorScheme[action.id] || "text-muted-foreground";
    return (
      <div
        key={action.id}
        className="flex items-center justify-between text-sm"
      >
        <div className="flex items-center gap-3 text-muted-foreground">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span>{action.label}</span>
        </div>
        <div className="flex gap-2 justify-end">
          <Input
            value={keys[0] || ""}
            onChange={(e) => handleChange(action.id, e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-12 h-8 text-center uppercase font-mono text-xs"
            placeholder="-"
            maxLength={2}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      {SNOOZE_ACTIONS.map((action) => renderActionRow(action as SnoozeAction))}
    </div>
  );
}
