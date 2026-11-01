// Shapes a frame clips its photo to, as SVG paths in a 1×1 box that's
// stretched to the frame's size. Frames store the id as a plain string, so
// a client that doesn't know a newer shape draws a square instead of
// dropping the frame.

export interface FrameShape {
  id: string;
  label: string;
  path: string;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

// A five-pointed star stretched to touch all four sides of its box
const starPath = (): string => {
  const points: [number, number][] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? 1 : 0.4;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  const [first, ...rest] = points.map(
    ([x, y]) => `${round((x - left) / width)} ${round((y - top) / height)}`
  );
  return `M${first}${rest.map((point) => `L${point}`).join("")}Z`;
};

export const FRAME_SHAPES: readonly FrameShape[] = [
  { id: "square", label: "Square", path: "M0 0H1V1H0Z" },
  {
    id: "rounded",
    label: "Rounded",
    path: "M0.15 0H0.85A0.15 0.15 0 0 1 1 0.15V0.85A0.15 0.15 0 0 1 0.85 1H0.15A0.15 0.15 0 0 1 0 0.85V0.15A0.15 0.15 0 0 1 0.15 0Z",
  },
  {
    id: "circle",
    label: "Circle",
    path: "M0.5 0A0.5 0.5 0 1 1 0.5 1A0.5 0.5 0 1 1 0.5 0Z",
  },
  {
    id: "arch",
    label: "Arch",
    path: "M0 1V0.5A0.5 0.5 0 0 1 1 0.5V1Z",
  },
  { id: "triangle", label: "Triangle", path: "M0.5 0L1 1H0Z" },
  { id: "diamond", label: "Diamond", path: "M0.5 0L1 0.5L0.5 1L0 0.5Z" },
  {
    id: "hexagon",
    label: "Hexagon",
    path: "M0.25 0H0.75L1 0.5L0.75 1H0.25L0 0.5Z",
  },
  { id: "star", label: "Star", path: starPath() },
  {
    id: "heart",
    label: "Heart",
    path: "M0.5 1C0.2 0.78 0 0.56 0 0.3C0 0.12 0.14 0 0.3 0C0.4 0 0.47 0.05 0.5 0.13C0.53 0.05 0.6 0 0.7 0C0.86 0 1 0.12 1 0.3C1 0.56 0.8 0.78 0.5 1Z",
  },
  {
    id: "blob",
    label: "Blob",
    path: "M0.52 0.02C0.72 0 0.92 0.12 0.97 0.35C1 0.57 0.9 0.8 0.7 0.92C0.5 1 0.24 0.98 0.1 0.8C0 0.63 0 0.38 0.12 0.2C0.22 0.06 0.35 0.03 0.52 0.02Z",
  },
];

const [SQUARE] = FRAME_SHAPES;

export const DEFAULT_FRAME_SHAPE = "circle";

export const frameShape = (id: string): FrameShape =>
  FRAME_SHAPES.find((shape) => shape.id === id) ?? SQUARE ?? FRAME_SHAPES[0];
