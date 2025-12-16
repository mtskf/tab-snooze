import React, { useState, useEffect } from 'react';
import logo from '../assets/logo.svg';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings } from '@/utils/timeUtils';
import { Trash2, ExternalLink, AppWindow, Download, Upload, Check, ChevronsUpDown, Inbox, Settings, Github, Coffee, RotateCcw, Globe } from 'lucide-react';
import { cn } from "@/lib/utils";
import { TimezoneSelect } from '@/components/TimezoneSelect';
import SnoozedList from './SnoozedList';
import { DEFAULT_SHORTCUTS } from '@/utils/constants';
import ShortcutEditor from './ShortcutEditor';
export default function Options() {
    const [snoozedTabs, setSnoozedTabs] = useState({});
    const [settings, setSettings] = useState({});
    const [activeTab, setActiveTab] = useState(() => {
        // Check URL hash for initial tab
        const hash = window.location.hash.slice(1);
        return hash === 'settings' ? 'settings' : 'snoozed-tabs';
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

        // Listen for changes
        const listener = (changes, area) => {
            if (area === 'local') {
                if (changes.snoozedTabs) setSnoozedTabs(changes.snoozedTabs.newValue || {});
                // For settings, we might want to re-merge if partial?
                // But usually changes.settings.newValue is the full object from set() actions.
                if (changes.settings) setSettings(changes.settings.newValue || {});
            }
        };
        chrome.storage.onChanged.addListener(listener);
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



    const clearAll = () => {
        if (confirm("Are you sure you want to clear all snoozed tabs?")) {
             chrome.runtime.sendMessage({ action: "clearAllSnoozedTabs" });
        }
    };

    // Export snoozed tabs to JSON
    const handleExport = () => {
        if (!snoozedTabs || Object.keys(snoozedTabs).length === 0 || (Object.keys(snoozedTabs).length === 1 && snoozedTabs.tabCount === 0)) {
            alert("No tabs to export.");
            return;
        }

        const data = JSON.stringify(snoozedTabs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snooooze-export-${new Date().toISOString().split('T')[0]}.json`;
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

                if (!importedTabs || typeof importedTabs !== 'object') {
                    throw new Error("Invalid JSON format");
                }

                chrome.storage.local.get("snoozedTabs", (res) => {
                    const currentTabs = res.snoozedTabs || { tabCount: 0 };
                    let importedCount = 0;

                    Object.keys(importedTabs).forEach(key => {
                        if (key === 'tabCount') return;

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
                    Object.keys(currentTabs).forEach(k => {
                        if (k !== 'tabCount' && Array.isArray(currentTabs[k])) {
                            totalCount += currentTabs[k].length;
                        }
                    });
                    currentTabs.tabCount = totalCount;

                    chrome.storage.local.set({ snoozedTabs: currentTabs }, () => {
                        alert(`Imported ${importedCount} tabs successfully!`);
                    });
                });

            } catch (error) {
                // console.error(error);
                alert("Failed to import: Invalid JSON file.");
            }
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    };

    return (
        <div className="container max-w-3xl py-8">
            <img src={logo} alt="Snooze" className="h-8 mb-6" />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
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
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Snoozed tabs</CardTitle>
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

                                {(snoozedTabs.tabCount > 0) && (
                                    <Button
                                        variant="destructive"
                                        size="xs"
                                        className="h-7 text-[10px]"
                                        onClick={clearAll}
                                    >
                                        <Trash2 className="mr-2 h-3 w-3" />
                                        Delete All
                                    </Button>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent>
                            <SnoozedList snoozedTabs={snoozedTabs} onClearTab={clearTab} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>

                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Snooze Timing</label>

                                    <div className="grid grid-cols-1 sm:grid-cols-10 gap-3">
                                <div className="space-y-2 sm:col-span-3">
                                    <label className="text-[10px] font-medium">Start Day (Morning)</label>
                                    <Select
                                        value={settings['start-day'] || '9:00 AM'}
                                        onValueChange={(value) => updateSetting('start-day', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'].map((time) => (
                                                <SelectItem key={time} value={time}>{time}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-3">
                                    <label className="text-[10px] font-medium">End Day (Evening)</label>
                                    <Select
                                        value={settings['end-day'] || '6:00 PM'}
                                        onValueChange={(value) => updateSetting('end-day', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'].map((time) => (
                                                <SelectItem key={time} value={time}>{time}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 sm:col-span-4">
                                    <label className="text-[10px] font-medium">Timezone</label>
                                    <TimezoneSelect
                                        value={settings['timezone']}
                                        onValueChange={(value) => updateSetting('timezone', value)}
                                    />
                                    </div>
                                </div>
                                </div>
                                <div className="space-y-2 sm:col-span-12 pt-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Keyboard Shortcuts</label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                if (confirm("Reset all shortcuts to default?")) {
                                                    updateSetting('shortcuts', DEFAULT_SHORTCUTS);
                                                }
                                            }}
                                        >
                                            <RotateCcw className="mr-1.5 h-3 w-3" />
                                            Reset default
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground pb-2">Customize hotkeys for each snooze option (Max 2 keys, no modifiers).</p>
                                    <ShortcutEditor
                                        shortcuts={settings.shortcuts || DEFAULT_SHORTCUTS}
                                        onUpdate={(newShortcuts) => updateSetting('shortcuts', newShortcuts)}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-medium">Open in New Tab</label>
                                    <p className="text-xs text-muted-foreground">Open snoozed tabs in a new tab instead of window.</p>
                                </div>
                                <Switch
                                    checked={settings['open-new-tab'] === 'true'}
                                    onCheckedChange={(c) => updateSetting('open-new-tab', c ? 'true' : 'false')}
                                />
                            </div>
                        </CardContent>
                    </Card>


                </TabsContent>
            </Tabs>

            <div className="mt-8 mb-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <a href="https://mtskf.github.io/Snooooze/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Globe className="h-3 w-3" />
                    <span>Website</span>
                </a>
                <span>•</span>
                <a href="https://github.com/mtskf/Snooooze" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Github className="h-3 w-3" />
                    <span>GitHub</span>
                </a>
                <span>•</span>
                <span>v0.0.0 Beta</span>
                <span>•</span>
                <a href="https://github.com/mtskf/Snooooze/issues" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
                    Report an Issue
                </a>
                <span>•</span>
                <a href="https://buymeacoffee.com/mtskf" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Coffee className="h-3 w-3" />
                    <span>Buy me a coffee</span>
                </a>
            </div>
        </div>
    );
}
