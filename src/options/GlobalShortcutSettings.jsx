import React from 'react';
import { Button } from '@/components/ui/button';
import { Keyboard, Settings } from 'lucide-react';

export default function GlobalShortcutSettings({ extensionShortcut }) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2 mt-4">
                <span className="text-xs text-muted-foreground font-medium">Global shortcut</span>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3 text-muted-foreground">
                        <Keyboard className="h-4 w-4 text-primary" />
                        <span>Activate Extension</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <Button
                        variant="outline"
                        onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
                    >
                        <Settings className="mr-2 h-3 w-3 text-muted-foreground" />
                        {extensionShortcut || 'Not set'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
