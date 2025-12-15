import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getSettings } from '@/utils/timeUtils';
import { Trash2, ExternalLink, AppWindow } from 'lucide-react';

export default function Options() {
    const [snoozedTabs, setSnoozedTabs] = useState({});
    const [settings, setSettings] = useState({});
    const [activeTab, setActiveTab] = useState("snoozed-tabs");

    useEffect(() => {
        // Initial load
        chrome.storage.local.get(["snoozedTabs", "settings"], (res) => {
            if (res.snoozedTabs) setSnoozedTabs(res.snoozedTabs);
            if (res.settings) setSettings(res.settings);
            else {
                 getSettings().then(setSettings); // Load defaults if empty
            }
        });

        // Listen for changes
        const listener = (changes, area) => {
            if (area === 'local') {
                if (changes.snoozedTabs) setSnoozedTabs(changes.snoozedTabs.newValue || {});
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
             chrome.storage.local.set({ snoozedTabs: { tabCount: 0 } });
        }
    };

    // Helper to list tabs
    const renderSnoozedList = () => {
        const timestamps = Object.keys(snoozedTabs).sort();
        const days = [];

        timestamps.forEach(ts => {
            if (ts === 'tabCount') return;
            const tabs = snoozedTabs[ts];
            if (!tabs || tabs.length === 0) return;

            const date = new Date(parseInt(ts));
            const dayKey = date.toDateString();

            let dayGroup = days.find(d => d.key === dayKey);
            if (!dayGroup) {
                dayGroup = { key: dayKey, date: date, items: [] };
                days.push(dayGroup);
            }

            tabs.forEach(tab => {
                dayGroup.items.push({ ...tab, popTime: parseInt(ts) });
            });
        });

        if (days.length === 0) {
            return <div className="text-center p-8 text-muted-foreground">No snoozed tabs.</div>;
        }

        return days.map(day => (
            <div key={day.key} className="mb-6">
                <h3 className="text-lg font-semibold mb-2 ml-1">{formatDay(day.date)}</h3>
                <div className="grid gap-2">
                    {day.items.map((tab, idx) => (
                        <Card key={`${tab.url}-${tab.creationTime}-${idx}`} className="flex flex-row items-center p-3 justify-between">
                             <div className="flex items-center gap-3 overflow-hidden">
                                {tab.favicon && <img src={tab.favicon} className="w-4 h-4" alt="" />}
                                <div className="flex flex-col overflow-hidden">
                                    <a href={tab.url} target="_blank" rel="noreferrer" className="text-sm font-medium truncate hover:underline block max-w-[400px]">
                                        {tab.title}
                                    </a>
                                    <span className="text-xs text-muted-foreground flex gap-2">
                                        <span>{tab.url ? new URL(tab.url).hostname : 'Unknown'}</span>
                                        <span>•</span>
                                        <span>{formatTime(tab.popTime)}</span>
                                    </span>
                                </div>
                             </div>
                             <Button variant="ghost" size="icon" onClick={() => clearTab(tab)}>
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                        </Card>
                    ))}
                </div>
            </div>
        ));
    };

    return (
        <div className="container max-w-3xl py-8">
            <h1 className="text-3xl font-bold mb-6">Snooooze</h1>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="snoozed-tabs">Snoozed</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="snoozed-tabs">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Snoozed</CardTitle>
                                <CardDescription>Manage your snoozed tabs.</CardDescription>
                            </div>
                            {(snoozedTabs.tabCount > 0) && (
                                <Button variant="destructive" size="sm" onClick={clearAll}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear All
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {renderSnoozedList()}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                            <CardDescription>Configure your snoozing preferences.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Start Day</label>
                                    <Input
                                        // Simple time conversion needed if format differs, but assuming HH:mm for simplicity in this rewrite or text
                                        // Original was "9:00 AM". Native time input uses "09:00".
                                        // I'll stick to text for now to match storage format or migrate later.
                                        // Let's use text to avoid heavy migration logic right now.
                                        value={settings['start-day'] || ''}
                                        onChange={(e) => updateSetting('start-day', e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">Format: 9:00 AM</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">End Day</label>
                                    <Input
                                        value={settings['end-day'] || ''}
                                        onChange={(e) => updateSetting('end-day', e.target.value)}
                                    />
                                </div>
                             </div>

                             <div className="space-y-2">
                                <label className="text-sm font-medium">Timezone</label>
                                <Input
                                    value={settings['timezone'] || ''}
                                    placeholder={Intl.DateTimeFormat().resolvedOptions().timeZone}
                                    onChange={(e) => updateSetting('timezone', e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Format: Region/City (e.g. Asia/Tokyo). Leave empty to use system default.
                                </p>
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
        </div>
    );
}

function formatDay(date) {
    // Simple formatter
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
