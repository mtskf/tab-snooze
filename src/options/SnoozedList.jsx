import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

const SnoozedList = React.memo(({ snoozedTabs, onClearTab }) => {
    const renderList = () => {
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
                <h3 className="text-sm font-medium mb-2 ml-1 text-muted-foreground">{formatDay(day.date)}</h3>
                <div className="grid gap-2">
                    {day.items.map((tab, idx) => (
                        <Card key={`${tab.url}-${tab.creationTime}-${idx}`} className="flex flex-row items-center p-3 justify-between hover:bg-accent/5 transition-colors">
                             <div className="flex items-center gap-3 overflow-hidden">
                                {tab.favicon && <img src={tab.favicon} className="w-4 h-4 ml-1" alt="" />}
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
                             <Button variant="ghost" size="icon" onClick={() => onClearTab(tab)} className="hover:text-destructive">
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                        </Card>
                    ))}
                </div>
            </div>
        ));
    };

    return (
        <div>
            {renderList()}
        </div>
    );
});

function formatDay(date) {
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default SnoozedList;
