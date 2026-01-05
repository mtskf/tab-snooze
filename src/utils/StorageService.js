/**
 * StorageService - File I/O utilities for import/export
 *
 * This service handles only file reading and downloading.
 * All validation and migration logic is handled by the background (snoozeLogic).
 */
export const StorageService = {
  /**
   * Triggers a browser download of the given data as a JSON file.
   * @param {Object} data - The data to download
   * @param {string} [filename] - Optional filename (defaults to timestamped name)
   */
  downloadAsJson: (data, filename) => {
    if (!data || typeof data !== 'object') {
      throw new Error("No data to export.");
    }

    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `snooooze-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Reads a JSON file and returns the parsed content.
   * Does NOT validate the data - validation is done by the background.
   * @param {File} file - The file object from input[type="file"]
   * @returns {Promise<Object>} - The parsed JSON object
   */
  readJsonFile: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },

  // Legacy aliases for backward compatibility during transition
  exportTabs: (data) => {
    // Check for valid V2 data with items (for Phase 1 compatibility)
    if (!data || !data.items || Object.keys(data.items).length === 0) {
      throw new Error("No tabs to export.");
    }
    StorageService.downloadAsJson(data);
  },

  parseImportFile: (file) => {
    // Just parse the file, no validation (validation moved to background)
    return StorageService.readJsonFile(file);
  },
};
