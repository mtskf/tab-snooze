import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { SNOOZE_ACTIONS } from '@/utils/constants';

// ShortcutEditor component
// props:
// - shortcuts: object { 'later-today': ['1', 'L'], ... }
// - onUpdate: function(newShortcuts)
export default function ShortcutEditor({ shortcuts, onUpdate }) {

    const handleChange = (actionId, index, value) => {
        // Validation: Single char only, uppercase
        let char = value.slice(-1).toUpperCase(); // Take last char if multiple typed

        // Printable ASCII only (space to tilde)
        if (value.length > 1 && !char.match(/^[\x20-\x7E]+$/)) {
            char = '';
        }

        const currentKeys = shortcuts[actionId] ? [...shortcuts[actionId]] : [];
        if (!currentKeys[0]) currentKeys[0] = "";
        if (!currentKeys[1]) currentKeys[1] = "";

        // If char is empty (= delete), just set it empty
        currentKeys[index] = char;

        // Filter out empty strings for storage
        const cleanKeys = currentKeys.filter(k => k !== "");

        const newShortcuts = {
            ...shortcuts,
            [actionId]: cleanKeys
        };

        onUpdate(newShortcuts);
    };

    const handleKeyDown = (e) => {
        // Prevent default browser actions for some keys if needed,
        // but mostly we just want to block modifiers from being entered as text.
        // The Input's onChange handles the actual character extraction.
        // We might want to block non-alphanumeric keys here.
        if (e.key.length > 1 && e.key !== 'Backspace' && e.key !== 'Delete') {
             e.preventDefault(); // Block things like 'Shift', 'Control', 'Enter'
        }
    };

    return (
        <div className="grid grid-cols-1 gap-2">
            {SNOOZE_ACTIONS.map(action => {
                const keys = shortcuts[action.id] || [];
                return (
                    <div key={action.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground w-1/3">{action.label}</span>
                        <div className="flex gap-2 w-2/3 justify-end">
                            <Input
                                value={keys[0] || ''}
                                onChange={(e) => handleChange(action.id, 0, e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="w-12 h-8 text-center uppercase font-mono text-xs"
                                placeholder="-"
                                maxLength={2} // Allow a bit of buffer for typing replacement
                            />
                            <Input
                                value={keys[1] || ''}
                                onChange={(e) => handleChange(action.id, 1, e.target.value)}
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
