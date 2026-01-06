/**
 * Extracts hex color from a Tailwind arbitrary value class
 * e.g., "text-[#ff5733]" -> "#ff5733"
 */
export function getHexFromClass(cls: string | undefined): string | undefined {
  return cls?.replace("text-[", "").replace("]", "");
}
