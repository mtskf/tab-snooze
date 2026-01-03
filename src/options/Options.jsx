import React, { useState, useEffect } from "react";
import logo from "../assets/logo.svg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettings } from "@/utils/timeUtils";
import {
  Trash2,
  ExternalLink,
  AppWindow,
  Download,
  Upload,
  Check,
  ChevronsUpDown,
  Inbox,
  Settings,
  Github,
  Coffee,
  RotateCcw,
  Globe,
  Search,
  X,
  Keyboard,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SnoozedList from "./SnoozedList";
import {
  DEFAULT_SHORTCUTS,
  VIVID_COLORS,
  HEATMAP_COLORS,
} from "@/utils/constants";
import TimeSettings from "./TimeSettings";
import GlobalShortcutSettings from "./GlobalShortcutSettings";
import SnoozeActionSettings from "./SnoozeActionSettings";
import AppearanceSettings from "./AppearanceSettings";
import { Kbd } from "@/components/ui/kbd";
export default function Options() {
  const [snoozedTabs, setSnoozedTabs] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState({});
  const [extensionShortcut, setExtensionShortcut] = useState(null);
  const [sizeWarningActive, setSizeWarningActive] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL hash for initial tab
    const hash = window.location.hash.slice(1);
    return hash === "settings" ? "settings" : "snoozed-tabs";
  });

  const fileInputRef = React.useRef(null);

  useEffect(() => {
    // Initial load using helper to ensure defaults (like timezone) are merged
    getSettings().then((mergedSettings) => {
      setSettings(mergedSettings);
      // If timezone was missing and added by default, we might (optionally) want to persist it,
      // but for now local state is sufficient as it will be saved on any change.
    });

    chrome.storage.local.get(["snoozedTabs"], (res) => {
      if (res.snoozedTabs) setSnoozedTabs(res.snoozedTabs);
    });

    chrome.commands.getAll((commands) => {
      const actionCommand = commands.find((c) => c.name === "_execute_action");
      if (actionCommand) {
        setExtensionShortcut(actionCommand.shortcut);
      }
    });

    // Listen for changes
    const listener = (changes, area) => {
      if (area === "local") {
        if (changes.snoozedTabs)
          setSnoozedTabs(changes.snoozedTabs.newValue || {});
        // For settings, we might want to re-merge if partial?
        // But usually changes.settings.newValue is the full object from set() actions.
        if (changes.settings) setSettings(changes.settings.newValue || {});
        if (changes.sizeWarningActive !== undefined)
          setSizeWarningActive(changes.sizeWarningActive.newValue || false);
      }
    };
    chrome.storage.onChanged.addListener(listener);

    // Load size warning state
    chrome.storage.local.get(["sizeWarningActive"], (res) => {
      setSizeWarningActive(res.sizeWarningActive || false);
    });

    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    chrome.storage.local.set({ settings: newSettings });
    // Trigger badge update
    chrome.runtime.sendMessage({ action: "updateBadgeText" });
  };

  const clearTab = (tab) => {
    chrome.runtime.sendMessage({ action: "removeSnoozedTab", tab: tab });
  };

  const clearGroup = (groupId) => {
    chrome.runtime.sendMessage({
      action: "removeWindowGroup",
      groupId: groupId,
    });
  };

  const restoreGroup = (groupId) => {
    chrome.runtime.sendMessage(
      {
        action: "restoreWindowGroup",
        groupId: groupId,
      },
      () => {
        // Manual refresh to ensure UI sync
        chrome.storage.local.get(["snoozedTabs"], (res) => {
          if (res.snoozedTabs) setSnoozedTabs(res.snoozedTabs);
        });
      }
    );
  };

  const clearAll = () => {
    if (confirm("Are you sure you want to clear all snoozed tabs?")) {
      chrome.runtime.sendMessage({ action: "clearAllSnoozedTabs" });
    }
  };

  // Export snoozed tabs to JSON
  const handleExport = () => {
    if (
      !snoozedTabs ||
      Object.keys(snoozedTabs).length === 0 ||
      (Object.keys(snoozedTabs).length === 1 && snoozedTabs.tabCount === 0)
    ) {
      alert("No tabs to export.");
      return;
    }

    const data = JSON.stringify(snoozedTabs, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snooooze-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import from JSON
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTabs = JSON.parse(e.target.result);

        if (!validateImportData(importedTabs)) {
          throw new Error("Invalid data structure");
        }

        chrome.storage.local.get("snoozedTabs", (res) => {
          const currentTabs = res.snoozedTabs || { tabCount: 0 };
          let importedCount = 0;

          Object.keys(importedTabs).forEach((key) => {
            if (key === "tabCount") return;

            const tabsList = importedTabs[key];
            if (Array.isArray(tabsList)) {
              if (!currentTabs[key]) {
                currentTabs[key] = [];
              }
              // Avoid exact duplicates if possible?
              // For simplicity, just append. User can clean up.
              currentTabs[key].push(...tabsList);
              importedCount += tabsList.length;
            }
          });

          // Recalculate total count
          let totalCount = 0;
          Object.keys(currentTabs).forEach((k) => {
            if (k !== "tabCount" && Array.isArray(currentTabs[k])) {
              totalCount += currentTabs[k].length;
            }
          });
          currentTabs.tabCount = totalCount;

          // Use background setSnoozedTabs to trigger backup rotation and size check
          chrome.runtime.sendMessage(
            { action: "setSnoozedTabs", data: currentTabs },
            () => {
              alert(`Imported ${importedCount} tabs successfully!`);
            }
          );
        });
      } catch (error) {
        console.error(error);
        alert(
          `Failed to import: ${error.message === "Invalid data structure" ? "The file contains invalid data." : "Invalid JSON file."}`
        );
      }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset file input
  };

  const validateImportData = (data) => {
    if (!data || typeof data !== "object") return false;

    for (const [key, value] of Object.entries(data)) {
      if (key === "tabCount") {
        if (typeof value !== "number") return false;
        continue;
      }

      // Key must be a timestamp (number-like string)
      if (isNaN(parseInt(key))) return false;

      // Value must be an array of objects
      if (!Array.isArray(value)) return false;
      for (const item of value) {
        if (typeof item !== "object" || !item.url || !item.title) {
          return false;
        }
      }
    }
    return true;
  };

  const filteredTabs = React.useMemo(() => {
    if (!searchQuery) return snoozedTabs;
    const keywords = searchQuery
      .toLowerCase()
      .split(/[\s,]+/)
      .filter((k) => k.trim() !== "");
    if (keywords.length === 0) return snoozedTabs;

    const filtered = { tabCount: 0 };
    Object.keys(snoozedTabs).forEach((key) => {
      if (key === "tabCount") return;
      const tabs = snoozedTabs[key].filter((t) => {
        const title = (t.title || "").toLowerCase();
        const url = (t.url || "").toLowerCase();
        return keywords.every((k) => title.includes(k) || url.includes(k));
      });

      if (tabs.length > 0) {
        filtered[key] = tabs;
        filtered.tabCount += tabs.length; // Approximate count for display if needed
      }
    });
    return filtered;
  }, [snoozedTabs, searchQuery]);

  return (
    <div className="w-[672px] mx-auto py-8">
      <img src={logo} alt="Snooze" className="h-8 mb-6" />

      {sizeWarningActive && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Storage is almost full</AlertTitle>
          <AlertDescription>
            Delete or restore old tabs to free up space.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4 bg-secondary">
          <TabsTrigger value="snoozed-tabs">
            <Inbox className="h-4 w-4 mr-2" />
            Snoozed
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snoozed-tabs">
          <Card>
            <CardHeader>
              <CardTitle>Snoozed Items</CardTitle>
              <div className="flex items-center justify-between pt-4">
                <div className="relative w-[280px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tabs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-8 h-9 text-xs"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 text-[10px]"
                    onClick={handleExport}
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Export
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 text-[10px]"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-3 w-3" />
                    Import
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImport}
                    accept=".json"
                    className="hidden"
                  />

                  {snoozedTabs.tabCount > 0 && (
                    <Button
                      className={cn(
                        "h-7 text-[10px] px-2",
                        (!settings.appearance ||
                          settings.appearance === "default" ||
                          settings.appearance === "neo-carbon") &&
                          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                        (settings.appearance === "vivid" ||
                          settings.appearance === "heatmap") &&
                          "text-white hover:opacity-90"
                      )}
                      style={(() => {
                        const appearance = settings.appearance;
                        const getHex = (cls) =>
                          cls?.replace("text-[", "").replace("]", "");
                        if (appearance === "vivid" && VIVID_COLORS?.delete) {
                          return { backgroundColor: getHex(VIVID_COLORS.delete) };
                        }
                        if (appearance === "heatmap" && HEATMAP_COLORS?.delete) {
                          return { backgroundColor: getHex(HEATMAP_COLORS.delete) };
                        }
                        return {};
                      })()}
                      onClick={clearAll}
                    >
                      <Trash2 className="mr-2 h-3 w-3" />
                      Delete All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <SnoozedList
                snoozedTabs={filteredTabs}
                onClearTab={clearTab}
                onClearGroup={clearGroup}
                onRestoreGroup={restoreGroup}
                appearance={settings.appearance || "default"}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-10">
              <TimeSettings settings={settings} updateSetting={updateSetting} />

              <div className="space-y-8 pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">
                      Keyboard Shortcuts
                    </label>
                  </div>
                </div>

                <GlobalShortcutSettings extensionShortcut={extensionShortcut} />

                <SnoozeActionSettings
                  settings={settings}
                  updateSetting={updateSetting}
                  appearance={settings.appearance || "default"}
                />
              </div>

              <div className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium">Appearance</label>
                  </div>
                </div>

                <AppearanceSettings
                  settings={settings}
                  updateSetting={updateSetting}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 mb-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <a
          href="https://mtskf.github.io/Snooooze/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Globe className="h-3 w-3" />
          <span>Website</span>
        </a>
        <span>•</span>
        <a
          href="https://github.com/mtskf/Snooooze"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Github className="h-3 w-3" />
          <span>GitHub</span>
        </a>
        <span>•</span>
        <span>v0.2.6</span>
        <span>•</span>
        <a
          href="https://github.com/mtskf/Snooooze/issues"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Report an Issue
        </a>
        <span>•</span>
        <a
          href="https://buymeacoffee.com/mtskf"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Coffee className="h-3 w-3" />
          <span>Buy me a coffee</span>
        </a>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
