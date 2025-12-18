import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, AppWindow } from "lucide-react";
import { VIVID_COLORS, HEATMAP_COLORS } from "@/utils/constants";

import { cn } from "@/lib/utils";

const SnoozedList = React.memo(
  ({
    snoozedTabs,
    onClearTab,
    onClearGroup,
    onRestoreGroup,
    appearance = "default",
  }) => {
    // Delete color style
    const deleteHoverStyle = (() => {
      const getHex = (cls) => cls?.replace("text-[", "").replace("]", "");

      let colorClass = "hover:!text-destructive";

      if (appearance === "vivid" && VIVID_COLORS?.delete) {
        colorClass = `hover:!text-[${getHex(VIVID_COLORS.delete)}]`;
      } else if (appearance === "heatmap" && HEATMAP_COLORS?.delete) {
        colorClass = `hover:!text-[${getHex(HEATMAP_COLORS.delete)}]`;
      }
      return `${colorClass} hover:bg-transparent`;
    })();
    const renderList = () => {
      const timestamps = Object.keys(snoozedTabs).sort();
      const days = [];

      timestamps.forEach((ts) => {
        if (ts === "tabCount") return;
        const tabs = snoozedTabs[ts];
        if (!tabs || tabs.length === 0) return;

        const date = new Date(parseInt(ts));
        const dayKey = date.toDateString();

        let dayGroup = days.find((d) => d.key === dayKey);
        if (!dayGroup) {
          dayGroup = { key: dayKey, date: date, items: [] };
          days.push(dayGroup);
        }

        tabs.forEach((tab) => {
          dayGroup.items.push({ ...tab, popTime: parseInt(ts) });
        });
      });

      if (days.length === 0) {
        return (
          <div className="text-center p-8 text-muted-foreground">
            No snoozed tabs.
          </div>
        );
      }

      return days.map((day) => {
        // Further group day items by groupId
        const dayGroups = {};
        const dayUngrouped = [];

        day.items.forEach((item) => {
          if (item.groupId) {
            if (!dayGroups[item.groupId]) {
              dayGroups[item.groupId] = [];
            }
            dayGroups[item.groupId].push(item);
          } else {
            dayUngrouped.push(item);
          }
        });

        return (
          <div key={day.key} className="mb-6">
            <h3 className="text-sm font-medium mb-2 ml-1 text-muted-foreground">
              {formatDay(day.date)}
            </h3>
            <div className="grid gap-2">
              {/* Render Window Groups */}
              {Object.entries(dayGroups).map(([groupId, groupItems]) => (
                <Card
                  key={groupId}
                  className="p-0 bg-card hover:bg-accent/5 transition-colors overflow-hidden"
                >
                  {/* Group Header - Styled like a Snoozed Tab Item */}
                  <div
                    className={cn(
                      "flex flex-row items-center p-3 justify-between border-b border-border/40",
                      onRestoreGroup &&
                        "cursor-pointer hover:bg-accent/10 transition-colors",
                    )}
                    onClick={() => onRestoreGroup && onRestoreGroup(groupId)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon Facade */}
                      <div className="w-4 h-4 ml-1 flex items-center justify-center bg-muted/40 text-foreground rounded-[2px]">
                        <AppWindow className="w-3 h-3" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium hover:underline cursor-pointer">
                          Window Group
                        </span>
                        <span className="text-xs text-muted-foreground flex gap-2">
                          <span>{groupItems.length} tabs</span>
                          <span>•</span>
                          <span>{formatTime(groupItems[0].popTime)}</span>
                        </span>
                      </div>
                    </div>
                    {onClearGroup && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearGroup(groupId);
                        }}
                        className={cn(
                          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                          "h-8 w-8 text-muted-foreground",
                          deleteHoverStyle
                        )}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Inner Tabs List */}
                  <div className="p-3 pl-12 bg-muted/10">
                    {groupItems.map((tab, idx) => (
                      <div
                        key={`${tab.url}-${tab.creationTime}-${idx}`}
                        className="flex flex-row items-center justify-between group py-1"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          {tab.favicon && (
                            <img
                              src={tab.favicon}
                              className="w-3 h-3 grayscale opacity-70"
                              alt=""
                            />
                          )}
                          <a
                            href={tab.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm truncate hover:underline block max-w-[350px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {tab.title}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => onClearTab(tab)}
                          className={cn(
                            "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                            "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground",
                            deleteHoverStyle
                          )}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}

              {/* Render Ungrouped Tabs */}
              {dayUngrouped.map((tab, idx) => (
                <Card
                  key={`${tab.url}-${tab.creationTime}-${idx}`}
                  className="flex flex-row items-center p-3 justify-between hover:bg-accent/5 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {tab.favicon && (
                      <img src={tab.favicon} className="w-4 h-4 ml-1" alt="" />
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium truncate hover:underline block max-w-[400px]"
                      >
                        {tab.title}
                      </a>
                      <span className="text-xs text-muted-foreground flex gap-2">
                        <span>
                          {tab.url ? new URL(tab.url).hostname : "Unknown"}
                        </span>
                        <span>•</span>
                        <span>{formatTime(tab.popTime)}</span>
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClearTab(tab)}
                    className={cn(
                      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
                      "h-8 w-8 text-muted-foreground",
                      deleteHoverStyle
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Card>
              ))}
            </div>
          </div>
        );
      });
    };

    return <div>{renderList()}</div>;
  },
);

function formatDay(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default SnoozedList;
