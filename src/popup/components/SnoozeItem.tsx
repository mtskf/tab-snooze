import React from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import type { LucideIcon } from "lucide-react";

interface SnoozeItemData {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  shortcuts: string[];
}

interface SnoozeItemProps {
  item: SnoozeItemData;
  isFocused: boolean;
  onClick: () => void;
}

export function SnoozeItem({ item, isFocused, onClick }: SnoozeItemProps) {
  return (
    <button
      className={cn(
        "w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group text-left",
        isFocused && "bg-secondary/70 ring-1 ring-primary"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <item.icon className={cn("h-5 w-5", item.color)} />
        <span className="font-medium">{item.label}</span>
      </div>
      <div className="flex gap-1">
        {item.shortcuts.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </div>
    </button>
  );
}
