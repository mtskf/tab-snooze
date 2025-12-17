<div align="center">
  <img src="src/assets/logo.svg" alt="Snooooze Logo" height="120" />
  <h1 style="margin-top: 20px;">Snooooze</h1>
  <p><strong>The modern, privacy-focused tab snoozer for pros.</strong><br>
  Close tabs now. They reopen automatically when you're ready.</p>

  <p>
    <a href="https://www.buymeacoffee.com/mtskf" target="_blank">
      <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 48px !important;width: 174px !important;" />
    </a>
  </p>
  <p>
    <a href="https://mtskf.github.io/Snooooze/"><strong>🌐 Visit Website</strong></a>
  </p>

  <p>
    <a href="https://github.com/mtskf/Snooooze/blob/main/LICENSE">
      <img src="https://img.shields.io/github/license/mtskf/Snooooze?style=flat-square&color=4F46E5" alt="License" />
    </a>
    <a href="https://github.com/mtskf/Snooooze/releases">
      <img src="https://img.shields.io/badge/version-v0.0.0_Beta-blue.svg" alt="Version" />
    </a>
    <img src="https://img.shields.io/badge/Made%20with-Love-ff4081?style=flat-square" alt="Made with Love" />
  </p>
</div>

---

<br>

## ✨ Why Snooooze?

Declutter your browser and your mind. **Snooooze** helps you focus on the task at hand by temporarily stashing tabs away until you actually need them. No more "I'll read this later" tabs clogging your RAM.

- **🌑 Neo Carbon Theme**: A sleek, dark-mode-first aesthetic that looks great day or night.
- **⚡️ Zero Friction**: Snooze standard tabs or entire windows with keyboard shortcuts.
- **🔒 Privacy First**: All data is stored locally on your device. Nothing touches the cloud.

<br>

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **⏱️ Smart Scheduling** | Presets for "Later Today", "Tomorrow", "This Weekend", or pick a custom date. |
| **🔄 Auto Restoration** | Tabs magically reappear at the scheduled time—even if your computer was sleeping. |
| **🌍 Timezone Aware** | Automatically detects your system timezone. "9:00 AM" means *your* 9:00 AM, wherever you are. |
| **📥 Inbox Zero** | View pending tabs in a clean list. Delete or restore them early if you change your mind. |
| **💾 Backup & Sync** | Export your data to JSON to transfer between devices or keep safe. |

<br>

## ⌨️ Shortcuts

Master the keyboard to manage your tabs at the speed of thought.

| Action | Shortcut |
| :--- | :--- |
| **Open Snooze Popup** | `Cmd` + `.` (Default) - *Customizable in Chrome Extensions* |
| **Later Today** | `L` |
| **This Evening** | `E` |
| **Tomorrow** | `T` |
| **This Weekend** | `S` |
| **Next Monday** | `N` |
| **In a Week** | `W` |
| **In a Month** | `M` |
| **Pick Date** | `P` |
| **Snooze Window** | Hold `Shift` + any shortcut |

> **Tip**: Customize snooze shortcuts in **Snooze Settings**, and the global popup shortcut in **Chrome Extension Shortcuts**.

<br>

## 🛠️ Installation & Development

This extension is built with **React**, **Vite**, and **Tailwind CSS**.

1.  **Clone the repository**
    ```bash
    git clone https://github.com/mtskf/Snooooze.git
    cd Snooooze
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Start Dev Server** (Hot Module Replacement)
    ```bash
    pnpm run dev
    ```

4.  **Load in Chrome**
    1.  Go to `chrome://extensions/`
    2.  Enable **Developer mode** (top right)
    3.  Click **Load unpacked**
    4.  Select the `dist` directory.

## 📦 Release Workflow

To create a new release for the Chrome Web Store:

1.  **Bump Version**: Update version in `package.json` and `manifest.json`.
2.  **Build**: Run `pnpm run build`.
3.  **Package**: Zip the contents of the `dist` folder.
    *   `cd dist && zip -r ../release/snooooze-vX.X.X-release.zip .`
4.  **Upload**: Submit the zip file from the `release/` directory to the Chrome Web Store Dashboard.

<br>

## 📄 License

MIT © [mtskf](https://github.com/mtskf)
