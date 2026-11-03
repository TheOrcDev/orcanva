import type { ReactNode } from "react";

import { roboto } from "@/components/youtube-preview/roboto";
import { cn } from "@/lib/utils";
import type { PreviewTheme } from "@/lib/youtube-preview/details";
import {
  PREVIEW_FIXED_TOKENS,
  PREVIEW_THEME_TOKENS,
} from "@/lib/youtube-preview/theme";

// Sets the mock's colours, type and sizes for what's inside: the look's
// tokens as --yt-* variables, Roboto, and the layout's thumbnail width
// (--yt-thumb) and frame width (--yt-frame) in CSS pixels
export const MockSurface = ({
  children,
  className,
  frameWidth,
  theme,
  thumbnailWidth,
}: {
  children: ReactNode;
  className?: string;
  frameWidth?: number;
  theme: PreviewTheme;
  thumbnailWidth: number;
}) => {
  const tokens = PREVIEW_THEME_TOKENS[theme];
  return (
    <div
      className={cn(
        roboto.className,
        "bg-(--yt-bg) text-(--yt-text)",
        className
      )}
      style={{
        "--yt-active": tokens.active,
        "--yt-active-text": tokens.activeText,
        "--yt-avatar": tokens.avatar,
        "--yt-avatar-text": PREVIEW_FIXED_TOKENS.avatarText,
        "--yt-badge": PREVIEW_FIXED_TOKENS.badge,
        "--yt-badge-text": PREVIEW_FIXED_TOKENS.badgeText,
        "--yt-bg": tokens.bg,
        "--yt-block": tokens.block,
        "--yt-border": tokens.border,
        "--yt-frame": frameWidth === undefined ? undefined : `${frameWidth}px`,
        "--yt-letterbox": PREVIEW_FIXED_TOKENS.letterbox,
        "--yt-muted": tokens.muted,
        "--yt-surface": tokens.surface,
        "--yt-text": tokens.text,
        "--yt-thumb": `${thumbnailWidth}px`,
      }}
    >
      {children}
    </div>
  );
};
