import { validateSnoozedTabs, sanitizeSnoozedTabs, validateSnoozedTabsV2, sanitizeSnoozedTabsV2 } from "./validation";
import { detectSchemaVersion } from "../background/schemaVersioning";

export const StorageService = {
  /**
   * Triggers a browser download of the given data as a JSON file.
   * Supports V2 format: { version: 2, items: {...}, schedule: {...} }
   * @param {Object} data - The V2 data from storage
   */
  exportTabs: (data) => {
    // Check for valid V2 data with items
    if (!data || !data.items || Object.keys(data.items).length === 0) {
      throw new Error("No tabs to export.");
    }

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snooooze-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Reads and parses a JSON file, validates it, and prepares it for storage.
   * Supports both V1 and V2 formats.
   * @param {File} file - The file object from input[type="file"].
   * @returns {Promise<Object>} - The valid data object to be saved.
   */
  parseImportFile: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let importedData = JSON.parse(e.target.result);

          // Detect schema version
          const version = detectSchemaVersion(importedData);

          if (version === 2) {
            // V2 validation
            const validation = validateSnoozedTabsV2(importedData);
            if (!validation.valid) {
              console.warn("V2 validation errors, sanitizing:", validation.errors);
              importedData = sanitizeSnoozedTabsV2(importedData);
            }
            // Ensure version is present
            importedData.version = 2;
            resolve(importedData);
          } else {
            // V1 validation (backward compatibility)
            const validation = validateSnoozedTabs(importedData);
            if (!validation.valid && !validation.repairable) {
              console.error("Validation errors (unrecoverable):", validation.errors);
              reject(new Error("Invalid data structure that cannot be repaired"));
              return;
            }

            if (!validation.valid && validation.repairable) {
              console.warn("Repairing imported data:", validation.errors);
              importedData = sanitizeSnoozedTabs(importedData);
            }

            resolve(importedData);
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },
};
