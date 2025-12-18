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

export const SNOOZE_ACTIONS = [
  { id: "later-today", label: "Later today" },
  { id: "this-evening", label: "This evening" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this-weekend", label: "This weekend" },
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
};
