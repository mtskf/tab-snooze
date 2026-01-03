export const DEFAULT_SHORTCUTS = {
  "later-today": ["L"],
  "this-evening": ["E"],
  tomorrow: ["T"],
  "this-weekend": ["S"],
  "next-monday": ["N"],
  "in-a-week": ["W"],
  "in-a-month": ["M"],
  "pick-date": ["P"],
  "snoozed-items": ["I"],
  settings: [","],
};

// Centralized default settings (used by snoozeLogic.js and timeUtils.js)
export const DEFAULT_SETTINGS = {
  "start-day": "8:00 AM",
  "end-day": "5:00 PM",
  "week-begin": 1,
  "weekend-begin": 6,

};

export const SNOOZE_ACTIONS = [
  { id: "later-today", label: "Later today" },
  { id: "this-evening", label: "This evening" },
  { id: "tomorrow", label: "Tomorrow / This morning (after midnight)", settingsLabel: true },
  { id: "this-weekend", label: "This weekend / Next weekend (during weekend)", settingsLabel: true },
  { id: "next-monday", label: "Next Monday" },
  { id: "in-a-week", label: "In a week" },
  { id: "in-a-month", label: "In a month" },
  { id: "pick-date", label: "Pick Date" },
];

export const OTHER_SHORTCUTS = [
  { id: "snoozed-items", label: "Snoozed Items" },
  { id: "settings", label: "Settings" },
];

// Default (monochromatic gradient)
export const DEFAULT_COLORS = {
  "later-today": "text-sky-300",
  "this-evening": "text-sky-400",
  tomorrow: "text-blue-400",
  "this-weekend": "text-blue-500",
  "next-monday": "text-blue-600",
  "in-a-week": "text-indigo-500",
  "in-a-month": "text-indigo-600",
  "pick-date": "text-[#6540E9]",
};

// Vivid (semantic colors)
export const VIVID_COLORS = {
  "later-today": "text-[#22D3EE]",    // Cyan
  "this-evening": "text-[#A78BFA]",   // Purple
  tomorrow: "text-[#4F8CFF]",         // Blue
  "this-weekend": "text-[#22C55E]",   // Green
  "next-monday": "text-[#FACC15]",    // Yellow
  "in-a-week": "text-[#4F8CFF]",      // Blue
  "in-a-month": "text-[#A78BFA]",     // Purple
  "pick-date": "text-[#22D3EE]",      // Cyan
  "delete": "text-[#F43F5E]",         // Rose
};

// Warm Heatmap (activity-based warmth)
export const HEATMAP_COLORS = {
  "later-today": "text-[#FF2F6D]",    // Critical
  "this-evening": "text-[#FF3B3B]",   // Very Hot
  tomorrow: "text-[#FF5C1A]",         // Hot
  "this-weekend": "text-[#FF8C1A]",   // Warm
  "next-monday": "text-[#FF8C1A]",    // Warm
  "in-a-week": "text-[#FFB703]",      // Warm Start
  "in-a-month": "text-[#FFB703]/75",  // Warm Start (Dim)
  "pick-date": "text-[#FF8C1A]/60",   // Neutral (Escape)
  "delete": "text-[#FF2F6D]",         // Critical
};

export const RESTRICTED_PROTOCOLS = [
  'chrome:',
  'edge:',
  'brave:',
  'about:',
  'chrome-extension:',
  'file:'
];
