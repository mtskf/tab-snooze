import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Settings } from "@/types";

const MORNING_HOURS = [
  "4:00 AM",
  "5:00 AM",
  "6:00 AM",
  "7:00 AM",
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
] as const;

const EVENING_HOURS = [
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
] as const;

const DEFAULT_START_DAY = "8:00 AM";
const DEFAULT_END_DAY = "5:00 PM";

interface TimeSettingsProps {
  settings: Partial<Settings>;
  updateSetting: (key: keyof Settings, value: string | number) => void;
}

export default function TimeSettings({ settings, updateSetting }: TimeSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <label className="text-sm font-medium">Snooze Timing</label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              Start Day (Morning)
            </span>
          </div>
          <div className="w-[120px]">
            <Select
              value={settings["start-day"] || DEFAULT_START_DAY}
              onValueChange={(val) => updateSetting("start-day", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {MORNING_HOURS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs text-muted-foreground font-medium">
              End Day (Evening)
            </span>
          </div>
          <div className="w-[120px]">
            <Select
              value={settings["end-day"] || DEFAULT_END_DAY}
              onValueChange={(value) => updateSetting("end-day", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {EVENING_HOURS.map((time) => (
                  <SelectItem key={time} value={time}>
                    {time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
