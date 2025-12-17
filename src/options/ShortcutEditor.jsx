import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { SNOOZE_ACTIONS } from '@/utils/constants';
import { Clock, Moon, Sun, Armchair, Briefcase, CalendarDays } from 'lucide-react';

// Icon mapping for each action
const ACTION_ICONS = {
    'later-today': Clock,
    'this-evening': Moon,
    'tomorrow': Sun,
    'this-weekend': Armchair,
    'next-monday': Briefcase,
    'in-a-week': Briefcase,
    'in-a-month': CalendarDays,
    'pick-date': CalendarDays
};

// Color mapping for each action (matches Popup)
const ACTION_COLORS = {
    'later-today': 'text-amber-400',
    'this-evening': 'text-purple-400',
    'tomorrow': 'text-amber-400',
    'this-weekend': 'text-green-400',
    'next-monday': 'text-amber-400',
    'in-a-week': 'text-blue-400',
    'in-a-month': 'text-purple-400',
    'pick-date': 'text-indigo-400'
};

// ShortcutEditor component
// props:
// - shortcuts: object { 'later-today': ['L'], ... }
// - onUpdate: function(newShortcuts)
export default function ShortcutEditor({ shortcuts, onUpdate }) {

    const handleChange = (actionId, value) => {
        // Validation: Single char only, uppercase
        let char = value.slice(-1).toUpperCase(); // Take last char if multiple typed

        // Printable ASCII only (space 0x20 to tilde 0x7E)
        if (!char.match(/^[\x20-\x7E]$/)) {
            char = '';
        }

        const newShortcuts = {
            ...shortcuts,
            [actionId]: char ? [char] : []
        };

        onUpdate(newShortcuts);
    };

    const handleKeyDown = (e) => {
        // Block modifiers and non-character keys
        if (e.key.length > 1 && e.key !== 'Backspace' && e.key !== 'Delete') {
             e.preventDefault();
        }
    };

    return (
        <div className="grid grid-cols-1 gap-2">
            {SNOOZE_ACTIONS.map(action => {
                const keys = shortcuts[action.id] || [];
                const Icon = ACTION_ICONS[action.id] || CalendarDays;
                const iconColor = ACTION_COLORS[action.id] || 'text-muted-foreground';
                return (
                    <div key={action.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3 text-muted-foreground">
                            <Icon className={`h-4 w-4 ${iconColor}`} />
                            <span>{action.label}</span>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Input
                                value={keys[0] || ''}
                                onChange={(e) => handleChange(action.id, e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-12 h-8 text-center uppercase font-mono text-xs"
                                placeholder="-"
                                maxLength={2}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
