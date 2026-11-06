export const ROUTES = new Set([
  "play",
  "gamma",
  "games",
  "courses",
  "learn",
  "roadmap",
  "progress",
]);
export function routeFromHash(hash) {
  const value = hash.replace(/^#/, "");
  return ROUTES.has(value)
    ? value
    : value.startsWith("share=")
      ? "share"
      : "play";
}
export function createRouter(resolve, onLeave = () => {}) {
  let active = null;
  return {
    mount(route, root) {
      active?.unmount?.();
      onLeave();
      active = resolve(route);
      if (!active) throw Error("Unknown game route");
      active.mount(root);
    },
    unmount() {
      active?.unmount?.();
      active = null;
    },
  };
}
