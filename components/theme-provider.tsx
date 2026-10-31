"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { usePathname } from "next/navigation";
import * as React from "react";

import { isMarketingPath } from "@/lib/routes";

const isTypingTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

// Menus and listboxes use letter keys for type-ahead
const isInTypeahead = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest('[role="menu"], [role="listbox"]') !== null;

// Plain "d" toggles light/dark everywhere, including the editor (its own
// shortcuts never use a bare "d"; duplicate is ⌘D). A forced theme can't be
// toggled, so it does nothing there instead of changing the saved theme.
const ThemeHotkey = () => {
  const { forcedTheme, resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    if (forcedTheme) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key.toLowerCase() !== "d") {
        return;
      }

      if (isTypingTarget(event.target) || isInTypeahead(event.target)) {
        return;
      }

      setTheme(resolvedTheme === "dark" ? "light" : "dark");
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [forcedTheme, resolvedTheme, setTheme]);

  return null;
};

// Marketing pages are designed light-only. (Turning on cacheComponents would
// make usePathname here need a Suspense boundary.)
const ThemeProvider = ({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) => {
  const pathname = usePathname();

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={isMarketingPath(pathname) ? "light" : undefined}
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  );
};

export { ThemeProvider };
