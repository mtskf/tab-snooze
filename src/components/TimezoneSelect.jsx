
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";

const timezones = [
    { label: "North America", items: [
        { value: "America/New_York", label: "New York" },
        { value: "America/Chicago", label: "Chicago" },
        { value: "America/Denver", label: "Denver" },
        { value: "America/Los_Angeles", label: "Los Angeles" },
        { value: "America/Anchorage", label: "Anchorage" },
        { value: "Pacific/Honolulu", label: "Honolulu" },
        { value: "America/Toronto", label: "Toronto" },
        { value: "America/Vancouver", label: "Vancouver" },
        { value: "America/Phoenix", label: "Phoenix" },
        { value: "America/Mexico_City", label: "Mexico City" },
        { value: "America/Halifax", label: "Halifax" },
    ]},
    { label: "Europe", items: [
        { value: "Europe/London", label: "London" },
        { value: "Europe/Paris", label: "Paris" },
        { value: "Europe/Berlin", label: "Berlin" },
        { value: "Europe/Madrid", label: "Madrid" },
        { value: "Europe/Rome", label: "Rome" },
        { value: "Europe/Amsterdam", label: "Amsterdam" },
        { value: "Europe/Moscow", label: "Moscow" },
        { value: "Europe/Zurich", label: "Zurich" },
        { value: "Europe/Istanbul", label: "Istanbul" },
        { value: "Europe/Kyiv", label: "Kyiv" },
        { value: "Europe/Stockholm", label: "Stockholm" },
    ]},
    { label: "Asia", items: [
        { value: "Asia/Tokyo", label: "Tokyo" },
        { value: "Asia/Seoul", label: "Seoul" },
        { value: "Asia/Shanghai", label: "Shanghai" },
        { value: "Asia/Hong_Kong", label: "Hong Kong" },
        { value: "Asia/Singapore", label: "Singapore" },
        { value: "Asia/Kolkata", label: "Kolkata" },
        { value: "Asia/Dubai", label: "Dubai" },
        { value: "Asia/Bangkok", label: "Bangkok" },
        { value: "Asia/Jakarta", label: "Jakarta" },
        { value: "Asia/Taipei", label: "Taipei" },
        { value: "Asia/Kuala_Lumpur", label: "Kuala Lumpur" },
        { value: "Asia/Manila", label: "Manila" },
        { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh" },
        { value: "Asia/Jerusalem", label: "Jerusalem" },
        { value: "Asia/Riyadh", label: "Riyadh" },
    ]},
    { label: "Australia & Pacific", items: [
        { value: "Australia/Sydney", label: "Sydney" },
        { value: "Australia/Melbourne", label: "Melbourne" },
        { value: "Australia/Brisbane", label: "Brisbane" },
        { value: "Australia/Adelaide", label: "Adelaide" },
        { value: "Australia/Darwin", label: "Darwin" },
        { value: "Australia/Perth", label: "Perth" },
        { value: "Australia/Hobart", label: "Hobart" },
        { value: "Pacific/Auckland", label: "Auckland" },
        { value: "Pacific/Fiji", label: "Fiji" },
    ]},
    { label: "South America", items: [
        { value: "America/Sao_Paulo", label: "São Paulo" },
        { value: "America/Buenos_Aires", label: "Buenos Aires" },
        { value: "America/Lima", label: "Lima" },
        { value: "America/Santiago", label: "Santiago" },
        { value: "America/Bogota", label: "Bogotá" },
    ]},
    { label: "Africa", items: [
        { value: "Africa/Cairo", label: "Cairo" },
        { value: "Africa/Johannesburg", label: "Johannesburg" },
        { value: "Africa/Lagos", label: "Lagos" },
    ]},
];

function getGmtOffset(timeZone) {
    try {
        const now = new Date();
        const str = now.toLocaleString("en-US", { timeZone, timeZoneName: "longOffset" });
        const match = str.match(/GMT([+-]\d{2}:\d{2}|[+-]\d{1,2})/);
        if (match) {
            return `(GMT ${match[1]})`;
        }
        return "(GMT)";
    } catch (e) {
        return "";
    }
}

export function TimezoneSelect({ value, onValueChange }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
            >
                <span className="truncate">
                {value
                    ? (() => {
                        const item = timezones.flatMap(g => g.items).find((item) => item.value === value);
                        return item ? `${item.label} ${getGmtOffset(item.value)}` : "Select timezone...";
                    })()
                    : "Select timezone..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" side="bottom" align="start">
            <Command>
                <CommandInput placeholder="Search timezone..." />
                <CommandList className="max-h-[220px]">
                <CommandEmpty>No timezone found.</CommandEmpty>
                {timezones.map((group) => (
                    <CommandGroup key={group.label} heading={group.label}>
                    {group.items.map((item) => (
                        <CommandItem
                        key={item.value}
                        value={item.label} // Search by label (City)
                        onSelect={() => {
                            onValueChange(item.value);
                            setOpen(false);
                        }}
                        >
                        <Check
                            className={cn(
                            "mr-2 h-4 w-4",
                            value === item.value ? "opacity-100" : "opacity-0"
                            )}
                        />
                        <span className="font-normal">{item.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                            {getGmtOffset(item.value)}
                        </span>
                        </CommandItem>
                    ))}
                    </CommandGroup>
                ))}
                </CommandList>
            </Command>
            </PopoverContent>
        </Popover>
    );
}
