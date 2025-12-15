
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getTime } from '@/utils/timeUtils';
import { Clock, Moon, Sun, Armchair, Briefcase, CalendarDays, Monitor, AppWindow, Archive, Settings } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function Popup() {
    const [date, setDate] = useState();
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [scope, setScope] = useState('selected'); // 'selected' | 'window'
    const [tabCount, setTabCount] = useState(0);

    useEffect(() => {
        // Update tab count based on scope
        updateTabCount();

        // Listen for selection changes to update count dynamically
        const tabListener = () => updateTabCount();
        chrome.tabs.onHighlighted.addListener(tabListener);

        return () => {
            chrome.tabs.onHighlighted.removeListener(tabListener);
        }
    }, [scope]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return; // Don't trigger when typing

            const key = e.key.toUpperCase();

            // Pick Date shortcut
            if (key === '8' || key === 'P') {
                setIsCalendarOpen(true);
                return;
            }

            const item = items.find(i => i.shortcuts.includes(key));
            if (item) {
                handleSnooze(item.id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scope]); // Depends on scope for handleSnooze context

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

    const snoozeTabs = (time) => {
        if (!time) return; // Safety check

        const query = scope === 'selected'
            ? { currentWindow: true, highlighted: true }
            : { currentWindow: true };

        chrome.tabs.query(query, (tabs) => {
            tabs.forEach((tab) => {
                performSnooze(tab, time, false);
            });
            window.close();
        });
    }

    const performSnooze = (tab, time, closePopup) => {
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
            openInNewWindow: scope === 'window'
        }, (response) => {
             // The window.close() is now handled by snoozeTabs, not here.
             // This ensures all tabs are processed before closing.
        });
    }

    const items = [
        { id: 'later-today', label: 'Later today', icon: Clock, shortcuts: ['1', 'L'], color: 'text-amber-400' },
        { id: 'this-evening', label: 'This evening', icon: Moon, shortcuts: ['2', 'E'], color: 'text-purple-400' },
        { id: 'tomorrow', label: 'Tomorrow', icon: Sun, shortcuts: ['3', 'T'], color: 'text-amber-400' },
        { id: 'this-weekend', label: 'This weekend', icon: Armchair, shortcuts: ['4', 'S'], color: 'text-green-400' },
        { id: 'next-monday', label: 'Next Monday', icon: Briefcase, shortcuts: ['5', 'N'], color: 'text-amber-400' },
        { id: 'in-a-week', label: 'In a week', icon: Briefcase, shortcuts: ['6', 'W'], color: 'text-blue-400' },
        { id: 'in-a-month', label: 'In a month', icon: CalendarDays, shortcuts: ['7', 'M'], color: 'text-purple-400' },
    ];

    return (
        <div className="w-[350px] bg-background text-foreground min-h-[500px] flex flex-col">
            <div className="p-4 pt-6">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold">New Snooze</h1>
                    <Button size="icon" className="bg-secondary text-muted-foreground border border-border/50 h-8 w-8 hover:bg-secondary/80 shadow-none" onClick={() => chrome.runtime.openOptionsPage()}>
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>

                {/* Scope Selection via RadioGroup */}
                <RadioGroup value={scope} onValueChange={setScope} className="grid grid-cols-2 gap-3 mb-4">
                    <label
                        className={cn(
                            "cursor-pointer rounded-xl p-4 flex flex-col items-center justify-center gap-2 border-2 transition-all hover:bg-secondary",
                            scope === 'selected' ? "border-primary bg-accent/10" : "border-transparent bg-secondary/50"
                        )}
                    >
                        <div className="rounded-md bg-gradient-to-br from-pink-500 to-rose-500 p-2 text-white shadow-sm">
                            <AppWindow className="h-6 w-6" />
                        </div>
                        <span className="font-medium">Selected tabs</span>
                        <RadioGroupItem value="selected" id="scope-selected" className="mt-2" />
                    </label>

                    <label
                        className={cn(
                            "cursor-pointer rounded-xl p-4 flex flex-col items-center justify-center gap-2 border-2 transition-all hover:bg-secondary",
                            scope === 'window' ? "border-primary bg-accent/10" : "border-transparent bg-secondary/50"
                        )}
                    >
                         <div className="rounded-md bg-gradient-to-br from-blue-500 to-cyan-500 p-2 text-white shadow-sm">
                            <Archive className="h-6 w-6" />
                        </div>
                        <span className="font-medium">Window</span>
                        <RadioGroupItem value="window" id="scope-window" className="mt-2" />
                    </label>
                </RadioGroup>

                {/* Sub info */}


                <div className="space-y-1">
                    {items.map((item) => {
                        return (
                         <button
                            key={item.id}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group text-left"
                            onClick={() => handleSnooze(item.id)}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("h-5 w-5", item.color)} />
                                <span className="font-medium">{item.label}</span>
                            </div>
                            <div className="flex gap-1">
                                {item.shortcuts.map((key) => (
                                    <span key={key} className="bg-secondary text-muted-foreground text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded border border-border/50">
                                        {key}
                                    </span>
                                ))}
                            </div>
                        </button>
                    )})}

                {/* Pick Date */}
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                         <button
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors group text-left"
                        >
                            <div className="flex items-center gap-3">
                                <CalendarDays className={cn("h-5 w-5 text-indigo-400")} />
                                <span className="font-medium">Pick Date</span>
                            </div>
                            <div className="flex gap-1">
                                <span className="bg-secondary text-muted-foreground text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded border border-border/50">
                                    8
                                </span>
                                <span className="bg-secondary text-muted-foreground text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded border border-border/50">
                                    P
                                </span>
                            </div>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                         <Calendar
                            mode="single"
                            selected={date}
                            onSelect={handleDateSelect}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
            </div>
        </div>
    );
}
