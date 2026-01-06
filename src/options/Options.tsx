import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { getHexFromClass } from "@/utils/colorUtils";
import TimeSettings from "./TimeSettings";
import GlobalShortcutSettings from "./GlobalShortcutSettings";
import SnoozeActionSettings from "./SnoozeActionSettings";
import AppearanceSettings from "./AppearanceSettings";
import { Kbd } from "@/components/ui/kbd";
import { StorageService } from "@/utils/StorageService";
import { sendMessage, MESSAGE_ACTIONS } from "@/messages";
import { storage, commands } from "@/utils/ChromeApi";
import FailedTabsDialog from "./FailedTabsDialog";
import {
  filterByQuery,
  selectSnoozedItemsByDay,
  selectTabCount,
} from "@/utils/selectors";
import type { StorageV2, Settings as SettingsType, SnoozedItemV2 } from "@/types";

interface FailedTab {
  id: string;
  url: string;
  title?: string;
  favicon?: string;
}

export default function Options() {
  const [snoozedData, setSnoozedData] = useState<StorageV2>({ version: 2, items: {}, schedule: {} });
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<Partial<SettingsType>>({});
  const [extensionShortcut, setExtensionShortcut] = useState<string | null>(null);
  const [sizeWarningActive, setSizeWarningActive] = useState(false);
  const [failedTabsDialogOpen, setFailedTabsDialogOpen] = useState(false);
  const [failedTabs, setFailedTabs] = useState<FailedTab[]>([]);
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL hash for initial tab
    const hash = window.location.hash.slice(1);
    return hash === "settings" ? "settings" : "snoozed-tabs";
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchSnoozedTabs = useCallback(async () => {
    try {
      const response = await sendMessage(MESSAGE_ACTIONS.GET_SNOOZED_TABS_V2) as StorageV2 | null;
      setSnoozedData(response || { version: 2, items: {}, schedule: {} });
    } catch (error) {
      console.error('Failed to fetch snoozed tabs:', error);
      setSnoozedData({ version: 2, items: {}, schedule: {} });
    }
  }, []);

  useEffect(() => {
    // Initial load via Background API to ensure consistent defaults
    const loadInitialData = async () => {
      try {
        const response = await sendMessage(MESSAGE_ACTIONS.GET_SETTINGS) as SettingsType | null;
        setSettings(response || {});
      } catch (error) {
        console.error('Failed to load settings:', error);
        setSettings({});
      }
    };

    loadInitialData();
    fetchSnoozedTabs();

    commands.getAll().then((cmds) => {
      const actionCommand = cmds.find((c) => c.name === "_execute_action");
      if (actionCommand) {
        setExtensionShortcut(actionCommand.shortcut || null);
      }
    }).catch((error) => {
      console.error('Failed to load extension shortcut:', error);
      // Extension shortcut remains null - UI will show "Not set"
    });

    // Listen for changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local") {
        if (changes.snoooze_v2 || changes.snoozedTabs) {
          fetchSnoozedTabs();
        }
        // For settings, we might want to re-merge if partial?
        // But usually changes.settings.newValue is the full object from set() actions.
        if (changes.settings) setSettings(changes.settings.newValue || {});
        if (changes.sizeWarningActive !== undefined)
          setSizeWarningActive(Boolean(changes.sizeWarningActive.newValue));
      }
    };
    chrome.storage.onChanged.addListener(listener);

    // Load size warning state
    storage.getLocal(["sizeWarningActive"]).then((res: { sizeWarningActive?: boolean }) => {
      setSizeWarningActive(Boolean(res.sizeWarningActive));
    }).catch((error) => {
      console.error('Failed to load size warning state:', error);
      // Warning state defaults to false
    });

    // Check for failed tabs dialog trigger from URL query param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('showFailedTabs') === 'true') {
      // Load failed tabs from session storage
      storage.getSession(['failedRestoreTabs']).then((res: { failedRestoreTabs?: FailedTab[] }) => {
        const tabs = res.failedRestoreTabs;
        if (tabs && tabs.length > 0) {
          setFailedTabs(tabs);
          setFailedTabsDialogOpen(true);
          // Clear the session storage and URL param
          storage.removeSession('failedRestoreTabs');
          // Remove query param from URL without reload
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, '', newUrl);
        }
      }).catch((error) => {
        console.error('Failed to load failed tabs:', error);
      });
    }

    return () => chrome.storage.onChanged.removeListener(listener);
  }, [fetchSnoozedTabs]);

  const updateSetting = (key: keyof SettingsType, value: unknown) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    sendMessage(MESSAGE_ACTIONS.SET_SETTINGS, { data: newSettings }).catch(error => {
      console.error('Failed to update settings:', error);
    });
  };

  const clearTab = (tab: SnoozedItemV2) => {
    sendMessage(MESSAGE_ACTIONS.REMOVE_SNOOZED_TAB, { tab }).catch(error => {
      console.error('Failed to clear tab:', error);
    });
  };

  const clearGroup = (groupId: string) => {
    sendMessage(MESSAGE_ACTIONS.REMOVE_WINDOW_GROUP, { groupId }).catch(error => {
      console.error('Failed to clear group:', error);
    });
  };

  const restoreGroup = async (groupId: string) => {
    try {
      await sendMessage(MESSAGE_ACTIONS.RESTORE_WINDOW_GROUP, { groupId });
      // Manual refresh to ensure UI sync
      fetchSnoozedTabs();
    } catch (error) {
      console.error('Failed to restore group:', error);
    }
  };

  const clearAll = () => {
    if (confirm("Are you sure you want to clear all snoozed tabs?")) {
      sendMessage(MESSAGE_ACTIONS.CLEAR_ALL_SNOOZED_TABS).catch(error => {
        console.error('Failed to clear all tabs:', error);
      });
    }
  };

  // Export snoozed tabs to JSON (V2 format via background)
  const handleExport = async () => {
    try {
      const data = await sendMessage(MESSAGE_ACTIONS.EXPORT_TABS) as StorageV2 | null;
      if (!data || !data.items || Object.keys(data.items).length === 0) {
        alert("No tabs to export.");
        return;
      }
      StorageService.downloadAsJson(data);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Import from JSON (V1/V2 format, merged with existing data via background)
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Read raw JSON (no validation, background handles it)
      const rawData = await StorageService.readJsonFile(file);

      // Show confirmation dialog
      const confirmed = confirm(
        "インポートしたタブを既存データにマージします。ID衝突時は新しいIDが割り当てられます。"
      );

      if (!confirmed) {
        event.target.value = ""; // Clear file input on cancel
        return;
      }

      // Send to background for validation, migration, and merge
      const result = await sendMessage(MESSAGE_ACTIONS.IMPORT_TABS, { data: rawData }) as { success: boolean; addedCount?: number; error?: string };

      if (result.success) {
        alert(`Imported ${result.addedCount} tabs successfully!`);
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error) {
      console.error(error);
      alert(`Failed to import: ${(error as Error).message || "Invalid JSON file."}`);
    }
    event.target.value = ""; // Reset file input
  };

  // Filter V2 data using selector
  const filteredData = useMemo(() => {
    return filterByQuery(snoozedData, searchQuery);
  }, [snoozedData, searchQuery]);

  // Convert to display format
  const dayGroups = useMemo(() => {
    return selectSnoozedItemsByDay(filteredData);
  }, [filteredData]);

  // Get tab count
  const tabCount = useMemo(() => {
    return selectTabCount(snoozedData);
  }, [snoozedData]);

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

                  {tabCount > 0 && (
                    <Button
                      className={cn(
                        "h-7 text-[10px] px-2",
                        (!settings.appearance ||
                          settings.appearance === "default") &&
                          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                        (settings.appearance === "vivid" ||
                          settings.appearance === "heatmap") &&
                          "text-white hover:opacity-90"
                      )}
                      style={(() => {
                        const appearance = settings.appearance;
                        if (appearance === "vivid" && VIVID_COLORS?.delete) {
                          return { backgroundColor: getHexFromClass(VIVID_COLORS.delete) };
                        }
                        if (appearance === "heatmap" && HEATMAP_COLORS?.delete) {
                          return { backgroundColor: getHexFromClass(HEATMAP_COLORS.delete) };
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
                dayGroups={dayGroups}
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
        <a
          href="https://x.com/snooooze_dev"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
          </svg>
          <span>X (Twitter)</span>
        </a>
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
      <FailedTabsDialog
        open={failedTabsDialogOpen}
        onOpenChange={setFailedTabsDialogOpen}
        failedTabs={failedTabs}
      />
      <Toaster position="top-center" />
    </div>
  );
}
