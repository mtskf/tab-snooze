/**
 * Extracts hex color from a Tailwind arbitrary value class
 * e.g., "text-[#ff5733]" -> "#ff5733"
 * e.g., "text-[#ff5733]/75" -> "#ff5733" (strips opacity suffix)
 */
export function getHexFromClass(cls: string | undefined): string | undefined {
  if (!cls) return undefined;
  const match = cls.match(/text-\[(#[0-9a-fA-F]{3,8})\]/);
  return match?.[1];
}
