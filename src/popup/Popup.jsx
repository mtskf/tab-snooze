import React, { useState, useEffect } from 'react';
import logo from '../assets/logo.svg';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getTime } from '@/utils/timeUtils';
import { Clock, Moon, Sun, Armchair, Briefcase, CalendarDays, CalendarClock, CalendarRange, Monitor, AppWindow, Settings, Album, Inbox, Archive } from 'lucide-react';
import { cn } from "@/lib/utils";

import { DEFAULT_SHORTCUTS } from '@/utils/constants';

export default function Popup() {
    const [date, setDate] = useState();
    const [items, setItems] = useState([
         { id: 'later-today', label: 'Later today', icon: Clock, shortcuts: [], color: 'text-sky-400' },
         { id: 'this-evening', label: 'This evening', icon: Moon, shortcuts: [], color: 'text-indigo-400' },
         { id: 'tomorrow', label: 'Tomorrow', icon: Sun, shortcuts: [], color: 'text-blue-400' },
         { id: 'this-weekend', label: 'This weekend', icon: Armchair, shortcuts: [], color: 'text-teal-400' },
         { id: 'next-monday', label: 'Next Monday', icon: Briefcase, shortcuts: [], color: 'text-sky-500' },
         { id: 'in-a-week', label: 'In a week', icon: CalendarRange, shortcuts: [], color: 'text-blue-500' },
         { id: 'in-a-month', label: 'In a month', icon: Archive, shortcuts: [], color: 'text-indigo-500' },
    ]);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [scope, setScope] = useState('selected'); // 'selected' | 'window'
    const [tabCount, setTabCount] = useState(0);
    const [snoozedCount, setSnoozedCount] = useState(0);
    const [pickDateShortcut, setPickDateShortcut] = useState('P');

    useEffect(() => {
        // Update tab count based on scope
        updateTabCount();

        // Listen for selection changes to update count dynamically
        const tabListener = () => updateTabCount();
        chrome.tabs.onHighlighted.addListener(tabListener);

        // Fetch snoozed count
        chrome.storage.local.get(["snoozedTabs", "settings"], (result) => {
            const tabs = result.snoozedTabs || {};
            let count = 0;
            Object.keys(tabs).forEach(key => {
                if (key !== 'tabCount' && Array.isArray(tabs[key])) {
                    count += tabs[key].length;
                }
            });
            setSnoozedCount(count);

            // Merge shortcuts
            const userShortcuts = (result.settings || {}).shortcuts || {};
            const finalShortcuts = { ...DEFAULT_SHORTCUTS, ...userShortcuts };

            setItems(prevItems => prevItems.map(item => ({
                ...item,
                shortcuts: finalShortcuts[item.id] || []
            })));

            // Set pick-date shortcut (empty string if not set)
            const pdShortcut = finalShortcuts['pick-date']?.[0] || '';
            setPickDateShortcut(pdShortcut);
        });

        return () => {
            chrome.tabs.onHighlighted.removeListener(tabListener);
        }
    }, [scope]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return; // Don't trigger when typing

            let key = e.key.toUpperCase();

            // Shift handling for scope
            if (e.key === 'Shift') {
                setScope('window');
                return;
            }

            // Map Shift+Number symbols back to numbers
            const shiftMap = {
                '!': '1', '@': '2', '#': '3', '$': '4',
                '%': '5', '^': '6', '&': '7', '*': '8'
            };
            if (shiftMap[e.key]) {
                key = shiftMap[e.key];
            }

            if (key === 'ESCAPE') {
                 window.close();
            }

            // Calendar triggers (only if shortcut is set)
            if (pickDateShortcut && key === pickDateShortcut.toUpperCase()) {
                 setIsCalendarOpen(true);
                 return;
            }

            const item = items.find(i => i.shortcuts.includes(key));
            if (item) {
                // Use e.shiftKey directly for immediate scope detection
                handleSnoozeWithScope(item.id, e.shiftKey ? 'window' : 'selected');
            }
        };

        const handleKeyUp = (e) => {
            // Shift release always returns to 'selected'
            if (e.key === 'Shift') {
                setScope('selected');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [items]); // Remove scope dependency since we use e.shiftKey directly

    const updateTabCount = () => {
        if (scope === 'selected') {
            chrome.tabs.query({ currentWindow: true, highlighted: true }, (tabs) => {
                setTabCount(tabs.length);
            });
        } else {
             chrome.tabs.query({ currentWindow: true }, (tabs) => {
                setTabCount(tabs.length);
            });
        }
    }

    const handleSnooze = async (key) => {
        const time = await getTime(key);
        snoozeTabs(time);
    };

    const handleDateSelect = (selectedDate) => {
        if (selectedDate) {
            // Set to 9:00 AM on the selected date
            const targetDate = new Date(selectedDate);
            targetDate.setHours(9, 0, 0, 0);

            setDate(targetDate);
            snoozeTabs(targetDate);
            setIsCalendarOpen(false);
        }
    }

    // Handle snooze with explicit scope (for keyboard shortcuts with Shift)
    const handleSnoozeWithScope = async (key, explicitScope) => {
        const time = await getTime(key);
        snoozeTabsWithScope(time, explicitScope);
    };

    const snoozeTabs = (time) => {
        snoozeTabsWithScope(time, scope);
    }

    const snoozeTabsWithScope = (time, targetScope) => {
        if (!time) return; // Safety check

        const query = targetScope === 'selected'
            ? { currentWindow: true, highlighted: true }
            : { currentWindow: true };

        chrome.tabs.query(query, (tabs) => {
            // Generate groupId if multiple tabs or window scope
            // We use a simple timestamp + random suffix for unique ID
            const groupId = (tabs.length > 1 || targetScope === 'window')
                ? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                : null;

            tabs.forEach((tab) => {
                performSnooze(tab, time, targetScope === 'window', groupId);
            });
            window.close();
        });
    }

    const performSnooze = (tab, time, openInNewWindow, groupId = null) => {
        const tabToSend = {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl
        };

        chrome.runtime.sendMessage({
            action: "snooze",
            tab: tabToSend,
            popTime: time.getTime(),
            openInNewWindow: openInNewWindow,
            groupId: groupId
        }, (response) => {
             // The window.close() is now handled by snoozeTabs, not here.
             // This ensures all tabs are processed before closing.
        });
    }



    return (
        <div className="w-[350px] bg-background text-foreground min-h-[500px] flex flex-col">
            <div className="p-4 pt-6">
                <div className="flex justify-between items-center mb-4">
                    <img src={logo} alt="Snooze" className="h-6" />
                    <div className="flex gap-1">
                        <Button className="bg-secondary text-muted-foreground border border-border/50 h-8 px-3 hover:bg-secondary/80 shadow-none flex items-center gap-2" onClick={() => chrome.runtime.openOptionsPage()}>
                            <Inbox className="h-4 w-4" />

                            {snoozedCount > 0 && (
                                <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[#1077E2] text-[9px] text-white font-bold">
                                    {snoozedCount > 999 ? '999+' : snoozedCount}
                                </span>
                            )}
                        </Button>
                        <Button size="icon" className="bg-secondary text-muted-foreground border border-border/50 h-8 w-8 hover:bg-secondary/80 shadow-none" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('options/index.html#settings') })}>
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Scope Selection via RadioGroup */}
                <RadioGroup value={scope} onValueChange={setScope} className="grid grid-cols-2 gap-3 mb-4">
                    <label
                        className={cn(
                            "cursor-pointer rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border-2 transition-all hover:bg-secondary",
                            scope === 'selected' ? "border-primary bg-accent/10" : "border-transparent bg-secondary/50"
                        )}
                    >
                        <div className="rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 p-2 text-white shadow-sm">
                            <Album className="h-5 w-5" />
                        </div>
                        <span className="font-medium">Selected tabs</span>
                        <span className="text-[10px] text-muted-foreground">Default</span>
                        <RadioGroupItem value="selected" id="scope-selected" className="sr-only" />
                    </label>

                    <label
                        className={cn(
                            "cursor-pointer rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 border-2 transition-all hover:bg-secondary",
                            scope === 'window' ? "border-primary bg-accent/10" : "border-transparent bg-secondary/50"
                        )}
                    >
                         <div className="rounded-md bg-gradient-to-br from-slate-600 to-zinc-500 p-2 text-white shadow-sm">
                            <AppWindow className="h-5 w-5" />
                        </div>
                        <span className="font-medium">Window</span>
                        <span className="text-[10px] text-muted-foreground">Hold Shift</span>
                        <RadioGroupItem value="window" id="scope-window" className="sr-only" />
                    </label>
                </RadioGroup>

                {/* Sub info */}


                <div className="space-y-1">
                    {items.map((item) => {
                        return (
                         <button
                            key={item.id}
                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group text-left"
                            onClick={() => handleSnooze(item.id)}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("h-5 w-5", item.color)} />
                                <span className="font-medium">{item.label}</span>
                            </div>
                            <div className="flex gap-1">
                                {item.shortcuts.map((key) => (
                                    <Kbd key={key}>
                                        {key}
                                    </Kbd>
                                ))}
                            </div>
                        </button>
                    )})}

                {/* Pick Date */}
                <button
                    onClick={() => setIsCalendarOpen(true)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group text-left"
                >
                    <div className="flex items-center gap-3">
                        <CalendarDays className={cn("h-5 w-5 text-primary")} />
                        <span className="font-medium">Pick Date</span>
                    </div>
                    <div className="flex gap-1">
                        <Kbd>
                            {pickDateShortcut}
                        </Kbd>
                    </div>
                </button>

                {/* Calendar Modal Overlay */}
                {isCalendarOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
                        onClick={() => setIsCalendarOpen(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
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
                                captionLayout="dropdown-buttons"
                                fromYear={new Date().getFullYear()}
                                toYear={new Date().getFullYear() + 5}
                            />
                        </div>
                    </div>
                )}
            </div>
            </div>


        </div>
    );
}
