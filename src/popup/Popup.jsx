import React, { useState, useEffect } from "react";
import logo from "../assets/logo.svg";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

import { Calendar } from "@/components/ui/calendar";
import { getTime } from "@/utils/timeUtils";
import {
  Clock,
  Moon,
  Sun,
  Armchair,
  Briefcase,
  CalendarDays,
  CalendarRange,
  Settings,
  Inbox,
  Archive,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  DEFAULT_SHORTCUTS,
  DEFAULT_COLORS,
  VIVID_COLORS,
  HEATMAP_COLORS,
} from "@/utils/constants";
import { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
import { ScopeSelector } from "./components/ScopeSelector";
import { SnoozeItem } from "./components/SnoozeItem";

export default function Popup() {
  const [date, setDate] = useState();
  const [items, setItems] = useState([
    {
      id: "later-today",
      label: "Later today",
      icon: Clock,
      shortcuts: [],
      color: "text-sky-300",
    },
    {
      id: "this-evening",
      label: "This evening",
      icon: Moon,
      shortcuts: [],
      color: "text-sky-400",
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      icon: Sun,
      shortcuts: [],
      color: "text-blue-400",
    },
    {
      id: "this-weekend",
      label: "This weekend",
      icon: Armchair,
      shortcuts: [],
      color: "text-blue-500",
    },
    {
      id: "next-monday",
      label: "Next Monday",
      icon: Briefcase,
      shortcuts: [],
      color: "text-blue-600",
    },
    {
      id: "in-a-week",
      label: "In a week",
      icon: CalendarRange,
      shortcuts: [],
      color: "text-indigo-500",
    },
    {
      id: "in-a-month",
      label: "In a month",
      icon: Archive,
      shortcuts: [],
      color: "text-indigo-600",
    },
  ]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarScope, setCalendarScope] = useState("selected"); // Scope to use when snoozing via calendar
  const [scope, setScope] = useState("selected"); // 'selected' | 'window'
  const [pickDateShortcut, setPickDateShortcut] = useState("P");
  const [snoozedItemsShortcut, setSnoozedItemsShortcut] = useState("I");
  const [settingsShortcut, setSettingsShortcut] = useState(",");
  const [focusedIndex, setFocusedIndex] = useState(-1); // -1 = no focus, 0-6 = items, 7 = pick date
  const [appearance, setAppearance] = useState("default");
  const [isSnoozing, setIsSnoozing] = useState(false);
  const [startDayHour, setStartDayHour] = useState(9);
  const [endDayHour, setEndDayHour] = useState(18);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  useEffect(() => {
    // Fetch settings and apply shortcuts/colors
    chrome.storage.local.get(["snoozedTabs", "settings"], (result) => {
      // Merge shortcuts
      const userShortcuts = (result.settings || {}).shortcuts || {};
      const finalShortcuts = { ...DEFAULT_SHORTCUTS, ...userShortcuts };

      setItems((prevItems) =>
        prevItems.map((item) => {
          let colorScheme = DEFAULT_COLORS;
          const appSetting = (result.settings || {}).appearance;
          if (appSetting === "vivid") colorScheme = VIVID_COLORS;
          if (appSetting === "heatmap") colorScheme = HEATMAP_COLORS;
          return {
            ...item,
            shortcuts: finalShortcuts[item.id] || [],
            color: colorScheme[item.id] || item.color,
          };
        }),
      );

      // Set appearance
      setAppearance((result.settings || {}).appearance || "default");

      // Set pick-date shortcut (empty string if not set)
      const pdShortcut = finalShortcuts["pick-date"]?.[0] || "";
      setPickDateShortcut(pdShortcut);

      // Set snoozed-items and settings shortcuts
      setSnoozedItemsShortcut(finalShortcuts["snoozed-items"]?.[0] || "I");
      setSettingsShortcut(finalShortcuts["settings"]?.[0] || ",");

      // Parse start-day and end-day hours for visibility logic
      const parseTimeHour = (timeStr) => {
        if (!timeStr) return 9;
        const parts = timeStr.split(/[\s:]+/);
        let hour = parseInt(parts[0]);
        const meridian = parts[2];
        if (meridian === "AM" && hour === 12) hour = 0;
        if (meridian === "PM" && hour < 12) hour += 12;
        return hour;
      };
      setStartDayHour(parseTimeHour((result.settings || {})["start-day"] || "8:00 AM"));
      setEndDayHour(parseTimeHour((result.settings || {})["end-day"] || "5:00 PM"));
    });
  }, []);

  // Compute display items with visibility and dynamic labels
  const isEarlyMorning = currentHour < startDayHour;
  const isPastEndDay = currentHour >= endDayHour;
  const currentDay = new Date().getDay();
  const isWeekend = currentDay === 0 || currentDay === 6; // Sunday (0) or Saturday (6)

  const displayItems = items
    .filter((item) => {
      // Hide This Evening when past end-day
      if (item.id === "this-evening" && isPastEndDay) return false;
      return true;
    })
    .map((item) => {
      // Change Tomorrow to This morning when early morning
      if (item.id === "tomorrow" && isEarlyMorning) {
        return { ...item, label: "This morning" };
      }
      // Change This weekend to Next weekend when it's already weekend
      if (item.id === "this-weekend" && isWeekend) {
        return { ...item, label: "Next weekend" };
      }
      return item;
    })
    .sort((a, b) => {
      // Reorder: This morning should come before This evening
      if (a.id === "tomorrow" && isEarlyMorning && b.id === "this-evening") return -1;
      if (b.id === "tomorrow" && isEarlyMorning && a.id === "this-evening") return 1;
      return 0;
    });

  const handleSnooze = async (key) => {
    const time = await getTime(key);
    snoozeTabs(time);
  };

  const handleDateSelect = (selectedDate) => {
    if (selectedDate) {
      // Set to start-day time on the selected date
      const targetDate = new Date(selectedDate);
      targetDate.setHours(startDayHour, 0, 0, 0);

      setDate(targetDate);
      snoozeTabsWithScope(targetDate, calendarScope);
      setIsCalendarOpen(false);
    }
  };

  // Handle snooze with explicit scope (for keyboard shortcuts with Shift)
  const handleSnoozeWithScope = async (key, explicitScope) => {
    const time = await getTime(key);
    snoozeTabsWithScope(time, explicitScope);
  };

  const snoozeTabs = (time) => {
    snoozeTabsWithScope(time, scope);
  };

  const snoozeTabsWithScope = (time, targetScope) => {
    if (!time) return; // Safety check
    setIsSnoozing(true); // Show loading state

    const query =
      targetScope === "selected"
        ? { currentWindow: true, highlighted: true }
        : { currentWindow: true };

    chrome.tabs.query(query, async (tabs) => {
      // Generate groupId if multiple tabs or window scope
      // We use a simple timestamp + random suffix for unique ID
      const groupId =
        tabs.length > 1 || targetScope === "window"
          ? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : null;

      const promises = tabs.map((tab) => {
        return performSnooze(tab, time, targetScope === "window", groupId);
      });

      await Promise.all(promises);
      window.close();
    });
  };

  const performSnooze = (tab, time, openInNewWindow, groupId = null) => {
    return new Promise((resolve) => {
      const tabToSend = {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        index: tab.index,
      };

      chrome.runtime.sendMessage(
        {
          action: "snooze",
          tab: tabToSend,
          popTime: time.getTime(),
          openInNewWindow: openInNewWindow,
          groupId: groupId,
        },
        () => {
          resolve();
        }
      );
    });
  };

  // Hidden command: 1-minute snooze (jjj) for debugging
  const handleOneMinuteSnooze = (targetScope) => {
    const time = new Date();
    time.setMinutes(time.getMinutes() + 1);
    time.setSeconds(0, 0);
    snoozeTabsWithScope(time, targetScope);
  };

  // Use the extracted hook
  useKeyboardNavigation({
    items: displayItems,
    focusedIndex,
    setFocusedIndex,
    setScope,
    scope,
    handleSnooze,
    handleSnoozeWithScope,
    handleOneMinuteSnooze,
    setIsCalendarOpen,
    setCalendarScope,
    pickDateShortcut,
    snoozedItemsShortcut,
    settingsShortcut,
  });

  return (
    <div className="w-[350px] bg-background text-foreground min-h-[500px] flex flex-col relative">
      {/* Loading Overlay */}
      {isSnoozing && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mt-2 text-sm text-muted-foreground">Snoozing...</span>
        </div>
      )}
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <img src={logo} alt="Snooze" className="h-6" />
          <div className="flex gap-1 items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-8 w-8"
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              <Inbox className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-8 w-8"
              onClick={() =>
                chrome.tabs.create({
                  url: chrome.runtime.getURL("options/index.html#settings"),
                })
              }
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scope Selection */}
        <ScopeSelector scope={scope} setScope={setScope} />

        {/* Sub info */}

        <div className="space-y-1">
          {displayItems.map((item, index) => (
            <SnoozeItem
              key={item.id}
              item={item}
              isFocused={focusedIndex === index}
              onClick={() => handleSnooze(item.id)}
            />
          ))}

          {/* Pick Date */}
          <button
            onClick={() => {
              setCalendarScope(scope); // Capture current scope when opening via mouse
              setIsCalendarOpen(true);
            }}
            className={cn(
              "w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group text-left",
              focusedIndex === items.length &&
                "bg-secondary/70 ring-1 ring-primary",
            )}
          >
            <div className="flex items-center gap-3">
              <CalendarDays
                className={cn(
                  `h-5 w-5 ${
                    appearance === "vivid"
                      ? VIVID_COLORS["pick-date"]
                      : appearance === "heatmap"
                      ? HEATMAP_COLORS["pick-date"]
                      : DEFAULT_COLORS["pick-date"]
                  }`
                )}
              />
              <span className="font-medium">Pick Date</span>
            </div>
            <div className="flex gap-1">
              <Kbd>{pickDateShortcut}</Kbd>
            </div>
          </button>

          {/* Calendar Modal Overlay */}
          {isCalendarOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
              onClick={() => setIsCalendarOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsCalendarOpen(false);
                }
              }}
              tabIndex={-1}
            >
              <div
                className="bg-popover rounded-lg border border-border shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  initialFocus
                  weekStartsOn={1}
                  captionLayout="dropdown-buttons"
                  fromYear={new Date().getFullYear()}
                  toYear={new Date().getFullYear() + 5}
                />
              </div>
            </div>
          )}
        </div>
        {/* Navigation hint */}
        <div className="text-center text-[9px] text-muted-foreground flex items-center justify-center gap-1">
          <Kbd>▲</Kbd>
          <Kbd>▼</Kbd> to navigate
        </div>
      </div>
    </div>
  );
}
