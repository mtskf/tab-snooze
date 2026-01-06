import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface FailedTab {
  id: string;
  url: string;
  title?: string;
  favicon?: string;
}

interface FailedTabsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  failedTabs: FailedTab[];
}

export default function FailedTabsDialog({ open, onOpenChange, failedTabs }: FailedTabsDialogProps) {
  const tabCount = failedTabs?.length || 0;

  // Extract hostname from URL for display
  const getHostname = (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Failed to Restore Tabs
          </DialogTitle>
          <DialogDescription>
            {tabCount > 0
              ? `${tabCount} tab${tabCount !== 1 ? "s" : ""} failed to restore. They will be retried automatically in 5 minutes.`
              : "No failed tabs to display."}
          </DialogDescription>
        </DialogHeader>

        {tabCount > 0 && (
          <div className="mt-4 max-h-[300px] overflow-y-auto space-y-2">
            {failedTabs.map((tab) => (
              <div
                key={tab.id}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
              >
                {tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tab.title || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {getHostname(tab.url)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tabCount === 0 && (
          <div className="mt-4 text-center text-muted-foreground py-8">
            No failed tabs to display.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
