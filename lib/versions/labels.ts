import type { VersionSummary } from "@/lib/versions/schema";

type Labelled = Pick<VersionSummary, "createdByName" | "kind" | "name">;

// "Jay's", "James'"
export const possessive = (name: string): string =>
  name.endsWith("s") ? `${name}'` : `${name}'s`;

// The version's name in the list: what it was saved as, or what made it
export const versionTitle = ({ kind, name }: Labelled): string => {
  switch (kind) {
    case "named": {
      return name ?? "Saved version";
    }
    case "restore": {
      return "Before restore";
    }
    case "auto": {
      return "Autosave";
    }
    default: {
      return kind satisfies never;
    }
  }
};

// Who and why: an auto version holds the design as it was before that
// person's edits, a restore version as it was before they restored another
export const versionByline = ({ createdByName, kind }: Labelled): string => {
  switch (kind) {
    case "named": {
      return `Saved by ${createdByName}`;
    }
    case "restore": {
      return `Before ${createdByName} restored an earlier version`;
    }
    case "auto": {
      return `Before ${possessive(createdByName)} edits`;
    }
    default: {
      return kind satisfies never;
    }
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface TimeOptions {
  // BCP 47; the browser's own when missing
  locale?: string;
  timeZone?: string;
}

// The calendar day of `date` in the time zone, for comparing days
const dayOf = (date: Date, timeZone: string | undefined): string =>
  new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(date);

// When it was taken: just the time today, "Yesterday, 14:02", the date
// without the year this year, and with it before that
export const formatVersionTime = (
  date: Date,
  now: Date,
  { locale, timeZone }: TimeOptions = {}
): string => {
  const time = new Intl.DateTimeFormat(locale, {
    timeStyle: "short",
    timeZone,
  }).format(date);
  const day = dayOf(date, timeZone);
  const today = dayOf(now, timeZone);
  if (day === today) {
    return time;
  }
  if (day === dayOf(new Date(now.getTime() - DAY_MS), timeZone)) {
    return `Yesterday, ${time}`;
  }
  const thisYear = day.slice(0, 4) === today.slice(0, 4);
  const calendarDate = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone,
    year: thisYear ? undefined : "numeric",
  }).format(date);
  return `${calendarDate}, ${time}`;
};
