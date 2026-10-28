// The macOS traffic-light position shared by every window, so the buttons sit on the same
// baseline as the renderer's 48px (h-12) top toolbar. `y` is the top of the ~14px cluster:
// (48 − 14) / 2 = 17. The renderer reserves room for the cluster with --titlebar-inset and
// --titlebar-traffic-width in src/renderer/index.css; change all three together. The derivation
// is in .agents/skills/shadcn/rules/app-window.md.
export const TRAFFIC_LIGHT_POSITION = { x: 19, y: 17 }
