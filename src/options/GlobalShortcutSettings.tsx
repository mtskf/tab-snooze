import React from "react";
import { Button } from "@/components/ui/button";
import { Keyboard, Settings } from "lucide-react";
import { tabs } from "@/utils/ChromeApi";

interface GlobalShortcutSettingsProps {
  extensionShortcut: string | null;
}

export default function GlobalShortcutSettings({ extensionShortcut }: GlobalShortcutSettingsProps) {
  const isFirefox = React.useMemo(() =>
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox'),
  []);

  const handleOpenShortcuts = () => {
    if (isFirefox) {
      // Firefox uses about:addons for extension management
      // But shortcuts are in the extension's own settings, so we show a message
      tabs.create({ url: "about:addons" }).catch((error) => {
        console.error('Failed to open addons page:', error);
      });
    } else {
      tabs.create({ url: "chrome://extensions/shortcuts" }).catch((error) => {
        console.error('Failed to open shortcuts page:', error);
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2 mt-4">
        <span className="text-xs text-muted-foreground font-medium">
          Global shortcut
        </span>
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
            onClick={handleOpenShortcuts}
          >
            <Settings className="mr-2 h-3 w-3 text-muted-foreground" />
            {extensionShortcut || "Not set"}
          </Button>
        </div>
      </div>
    </div>
  );
}
