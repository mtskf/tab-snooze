import { useEffect, useRef } from "react";

export function useKeyboardNavigation({
  items,
  focusedIndex,
  setFocusedIndex,
  setScope,
  scope,
  handleSnooze,
  handleSnoozeWithScope,
  handleOneMinuteSnooze,
  setIsCalendarOpen,
  pickDateShortcut,
  snoozedItemsShortcut,
  settingsShortcut,
}) {
  // Hidden command: track consecutive "j" presses
  const jPressRef = useRef({ count: 0, lastTime: 0 });
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT") return; // Don't trigger when typing

      let key = e.key.toUpperCase();
      const totalOptions = items.length + 1; // items + Pick Date

      // Hidden command: "jjj" - 3 consecutive j presses within 500ms
      if (e.key.toLowerCase() === "j") {
        const now = Date.now();
        if (now - jPressRef.current.lastTime < 500) {
          jPressRef.current.count++;
        } else {
          jPressRef.current.count = 1;
        }
        jPressRef.current.lastTime = now;

        if (jPressRef.current.count >= 3) {
          jPressRef.current.count = 0;
          // Shift held or window scope selected = snooze window
          const targetScope = e.shiftKey || scope === "window" ? "window" : "selected";
          handleOneMinuteSnooze(targetScope);
          return;
        }
      } else {
        // Reset counter if any other key is pressed
        jPressRef.current.count = 0;
      }

      // Arrow key navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setScope("selected");
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setScope("window");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % totalOptions);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && focusedIndex >= 0) {
        e.preventDefault();
        if (focusedIndex < items.length) {
          handleSnooze(items[focusedIndex].id);
        } else {
          setIsCalendarOpen(true);
        }
        return;
      }

      // Shift handling for scope
      if (e.key === "Shift") {
        setScope("window");
        return;
      }

      // Map Shift+Number symbols back to numbers
      const shiftMap = {
        "!": "1",
        "@": "2",
        "#": "3",
        $: "4",
        "%": "5",
        "^": "6",
        "&": "7",
        "*": "8",
      };
      if (shiftMap[e.key]) {
        key = shiftMap[e.key];
      }

      if (key === "ESCAPE") {
        window.close();
      }

      // Calendar triggers (only if shortcut is set)
      if (pickDateShortcut && key === pickDateShortcut.toUpperCase()) {
        setIsCalendarOpen(true);
        return;
      }

      // Snoozed items shortcut
      if (
        snoozedItemsShortcut &&
        key === snoozedItemsShortcut.toUpperCase()
      ) {
        chrome.runtime.openOptionsPage();
        return;
      }

      // Settings shortcut
      if (settingsShortcut && e.key === settingsShortcut) {
        chrome.tabs.create({
          url: chrome.runtime.getURL("options/index.html#settings"),
        });
        return;
      }

      const item = items.find((i) => i.shortcuts.includes(key));
      if (item) {
        // Use e.shiftKey directly for immediate scope detection
        handleSnoozeWithScope(item.id, e.shiftKey ? "window" : "selected");
      }
    };

    const handleKeyUp = (e) => {
      // Shift release always returns to 'selected'
      if (e.key === "Shift") {
        setScope("selected");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    items,
    focusedIndex,
    setFocusedIndex,
    setScope,
    scope,
    handleSnooze,
    handleSnoozeWithScope,
    handleOneMinuteSnooze,
    setIsCalendarOpen,
    pickDateShortcut,
    snoozedItemsShortcut,
    settingsShortcut,
  ]);
}
