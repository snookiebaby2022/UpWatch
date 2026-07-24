/** Injected at build time via VITE_BUILD_SHA (see .github/workflows/deploy.yml). */
export const BUILD_SHA =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_BUILD_SHA) || "local";

export const BUILD_LABEL = BUILD_SHA === "local" ? "local" : BUILD_SHA.slice(0, 7);
