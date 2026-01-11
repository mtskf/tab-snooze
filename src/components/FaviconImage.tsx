import React, { useState, useEffect } from "react";
import { Globe, type LucideIcon } from "lucide-react";

/**
 * Validates that a URL is safe for use as an image source.
 * Only allows http, https, and chrome-extension protocols to prevent XSS attacks.
 *
 * @param url - URL to validate
 * @returns true if the URL uses a safe protocol, false otherwise
 *
 * @security Prevents XSS via javascript:, data:, and other potentially malicious URL schemes
 */
function isSafeFaviconUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http(s) and chrome-extension protocols
    return ["http:", "https:", "chrome-extension:"].includes(parsed.protocol);
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Props for the FaviconImage component
 */
interface FaviconImageProps {
  /**
   * Favicon image URL. If null/undefined or fails to load, fallback icon is shown.
   */
  src?: string | null;
  /**
   * CSS class applied to the favicon image
   */
  className?: string;
  /**
   * CSS class applied to the fallback icon. If not provided, className is used.
   */
  fallbackClassName?: string;
  /**
   * Lucide icon component to display when favicon fails or is unavailable.
   * Defaults to Globe icon.
   */
  FallbackIcon?: LucideIcon;
}

/**
 * Resilient favicon image component with automatic error recovery.
 *
 * Displays a favicon image with graceful fallback to an icon when:
 * - src is null/undefined
 * - src uses an unsafe protocol (XSS protection)
 * - Image fails to load (404, CORS, network error)
 *
 * Error recovery mechanism:
 * 1. onError event triggers state update
 * 2. hasError state causes re-render to fallback icon
 * 3. Error state resets when src prop changes (allows retry)
 *
 * @param props - Component properties
 * @param props.src - Favicon URL to display (must use http/https/chrome-extension protocol)
 * @param props.className - CSS class for the favicon
 * @param props.fallbackClassName - CSS class for fallback icon (defaults to className)
 * @param props.FallbackIcon - Lucide icon to show on error (defaults to Globe)
 * @returns JSX element displaying favicon or fallback icon
 *
 * @security Only accepts http, https, and chrome-extension protocols to prevent XSS attacks.
 * URLs with javascript:, data:, or other protocols will show the fallback icon.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FaviconImage src={tab.favIconUrl} className="w-4 h-4" />
 *
 * // Custom fallback icon
 * <FaviconImage
 *   src={tab.favIconUrl}
 *   className="w-4 h-4"
 *   FallbackIcon={FileQuestion}
 * />
 *
 * // Different styling for fallback
 * <FaviconImage
 *   src={tab.favIconUrl}
 *   className="w-4 h-4"
 *   fallbackClassName="w-4 h-4 text-muted-foreground"
 * />
 * ```
 */
export function FaviconImage({
  src,
  className,
  fallbackClassName,
  FallbackIcon = Globe,
}: FaviconImageProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes to allow retry with new URL
  useEffect(() => {
    // Only reset if there's actually a new src to try
    if (src) {
      setHasError(false);
    }
  }, [src]);

  // Show fallback icon if no src provided, unsafe URL, or image failed to load
  if (!src || !isSafeFaviconUrl(src) || hasError) {
    return <FallbackIcon className={fallbackClassName ?? className} />;
  }

  return (
    <img
      src={src}
      className={className}
      alt=""
      role="presentation"
      onError={() => setHasError(true)} // Trigger error state on load failure
    />
  );
}
