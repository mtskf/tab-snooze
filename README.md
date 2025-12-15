# Snooooze

**Snooooze** allows you to "snooze" tabs and windows for later. They close immediately and reopen automatically at the scheduled time.

## Key Features

- **Snooze Tabs & Windows**: Snooze individual tabs or entire windows. Windows are restored as distinct windows (unless configured otherwise).
- **Flexible Scheduling**: Choose from presets like "Later Today", "Tomorrow Morning", "This Weekend", or pick a specific date and time.
- **Smart Restoration**:
  - **Global Control**: Configure whether tabs restore in the current window or a new window via Settings.
- **Timezone Aware**: Intelligent handling of timezones for start/end of day calculations.
- **Privacy Focused**: Everything runs locally. No data is sent to the cloud.

## Installation & Development

1.  Clone existing repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run development server:
    ```bash
    npm run dev
    ```
4.  Load extension in Chrome:
    - Go to `chrome://extensions/`
    - Enable "Developer mode"
    - Click "Load unpacked"
    - Select the `dist` directory.

## License

MIT
