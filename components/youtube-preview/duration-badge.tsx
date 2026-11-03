// The video's length over the thumbnail's bottom-right corner, which is
// what anything drawn there has to live with
export const DurationBadge = ({ duration }: { duration: string }) => (
  <span className="absolute right-1 bottom-1 rounded-sm bg-(--yt-badge) px-1 py-0.75 text-xs leading-3 font-medium text-(--yt-badge-text) tabular-nums">
    {duration}
  </span>
);
