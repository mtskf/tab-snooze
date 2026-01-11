import React, { useState, useEffect } from "react";
import { Globe, type LucideIcon } from "lucide-react";

interface FaviconImageProps {
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
  fallbackIcon?: LucideIcon;
}

/**
 * Favicon image with automatic error handling and fallback icon
 */
export function FaviconImage({
  src,
  className,
  fallbackClassName,
  FallbackIcon = Globe,
}: FaviconImageProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return <FallbackIcon className={fallbackClassName ?? className} />;
  }

  return (
    <img
      src={src}
      className={className}
      alt=""
      onError={() => setHasError(true)}
    />
  );
}
