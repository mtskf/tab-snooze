import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExternalLink, Star } from "lucide-react";
import { FaviconImage } from "./FaviconImage";

describe("FaviconImage", () => {
  describe("with valid src", () => {
    it("renders img element with correct src", () => {
      const { container } = render(
        <FaviconImage src="https://example.com/favicon.ico" className="test-class" />
      );
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/favicon.ico");
      expect(img).toHaveClass("test-class");
    });

    it("has role presentation for accessibility", () => {
      const { container } = render(
        <FaviconImage src="https://example.com/favicon.ico" />
      );
      const img = container.querySelector("img");
      expect(img).toHaveAttribute("role", "presentation");
    });
  });

  describe("fallback behavior", () => {
    it("shows default Globe icon when src is null", () => {
      const { container } = render(<FaviconImage src={null} className="test-class" />);
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(globeIcon).toHaveClass("test-class");
    });

    it("shows default Globe icon when src is undefined", () => {
      const { container } = render(<FaviconImage className="test-class" />);
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
    });

    it("shows default Globe icon when src is empty string", () => {
      const { container } = render(<FaviconImage src="" />);
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
    });

    it("uses fallbackClassName for fallback icon when provided", () => {
      const { container } = render(
        <FaviconImage
          src={null}
          className="img-class"
          fallbackClassName="fallback-class"
        />
      );
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toHaveClass("fallback-class");
      expect(globeIcon).not.toHaveClass("img-class");
    });

    it("uses className for fallback when fallbackClassName not provided", () => {
      const { container } = render(
        <FaviconImage src={null} className="shared-class" />
      );
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toHaveClass("shared-class");
    });
  });

  describe("custom FallbackIcon", () => {
    it("renders custom fallback icon when src is null", () => {
      const { container } = render(
        <FaviconImage src={null} FallbackIcon={ExternalLink} />
      );
      const externalLinkIcon = container.querySelector("svg.lucide-external-link");
      expect(externalLinkIcon).toBeInTheDocument();
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).not.toBeInTheDocument();
    });

    it("renders custom fallback icon on error", () => {
      const { container } = render(
        <FaviconImage
          src="https://example.com/broken.ico"
          FallbackIcon={Star}
        />
      );
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();

      // Simulate image load error
      fireEvent.error(img!);

      const starIcon = container.querySelector("svg.lucide-star");
      expect(starIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("shows fallback icon when image fails to load", () => {
      const { container } = render(
        <FaviconImage src="https://example.com/broken.ico" />
      );
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();

      // Simulate image load error
      fireEvent.error(img!);

      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("resets error state when src changes", () => {
      const { container, rerender } = render(
        <FaviconImage src="https://example.com/broken.ico" />
      );
      const img = container.querySelector("img");
      fireEvent.error(img!);

      // Verify fallback is shown
      expect(container.querySelector("svg.lucide-globe")).toBeInTheDocument();

      // Change src
      rerender(<FaviconImage src="https://example.com/new-favicon.ico" />);

      // Should show img again with new src
      const newImg = container.querySelector("img");
      expect(newImg).toBeInTheDocument();
      expect(newImg).toHaveAttribute("src", "https://example.com/new-favicon.ico");
    });
  });

  describe("security - XSS prevention", () => {
    it("blocks javascript: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="javascript:alert(document.cookie)" />
      );
      // Should show fallback icon, not img element
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("blocks data: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="data:text/html,<script>alert(1)</script>" />
      );
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("blocks data: URLs with SVG XSS payload", () => {
      const { container } = render(
        <FaviconImage src="data:image/svg+xml,<svg onload='alert(1)'>" />
      );
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("allows http: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="http://example.com/favicon.ico" />
      );
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "http://example.com/favicon.ico");
    });

    it("allows https: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="https://example.com/favicon.ico" />
      );
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/favicon.ico");
    });

    it("allows chrome-extension: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="chrome-extension://abcdef123456/icon.png" />
      );
      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute(
        "src",
        "chrome-extension://abcdef123456/icon.png"
      );
    });

    it("blocks file: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="file:///etc/passwd" />
      );
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });

    it("blocks ftp: protocol URLs", () => {
      const { container } = render(
        <FaviconImage src="ftp://example.com/file.ico" />
      );
      const globeIcon = container.querySelector("svg.lucide-globe");
      expect(globeIcon).toBeInTheDocument();
      expect(container.querySelector("img")).not.toBeInTheDocument();
    });
  });
});
