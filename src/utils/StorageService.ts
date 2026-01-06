/**
 * StorageService - File I/O utilities for import/export
 *
 * This service handles only file reading and downloading.
 * All validation and migration logic is handled by the background (snoozeLogic).
 */
export const StorageService = {
  /**
   * Triggers a browser download of the given data as a JSON file.
   */
  downloadAsJson: (data: unknown, filename?: string): void => {
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
   */
  readJsonFile: (file: File): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          resolve(data);
        } catch {
          reject(new Error("Invalid JSON file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  },
};
