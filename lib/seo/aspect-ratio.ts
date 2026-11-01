// Ratios read as people say them: whole numbers when they're small (16:9,
// 4:5), otherwise width per unit of height (1200×630 is 1.9:1, not 40:21)
const MAX_TERM = 21;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const aspectRatio = (width: number, height: number): string => {
  const divisor = gcd(width, height);
  const across = width / divisor;
  const down = height / divisor;
  if (across <= MAX_TERM && down <= MAX_TERM) {
    return `${across}:${down}`;
  }
  return `${Number((width / height).toFixed(2))}:1`;
};
