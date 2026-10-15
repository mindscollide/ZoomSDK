// Origins of the Diskus app allowed to control this iframe via postMessage.
// Set REACT_APP_PARENT_ORIGINS at build time as a comma-separated list, e.g.
// "https://portal.letsdiskus.com,https://secure.letsdiskus.com".
// Falls back to the local Diskus dev server when unset.
const DEFAULT_PARENT_ORIGINS = ["http://localhost:5173"];

const normalizeOrigin = (origin: string) =>
  origin.trim().replace(/\/+$/, "").toLowerCase();

const allowedParentOrigins: string[] = (() => {
  const configured = (process.env.REACT_APP_PARENT_ORIGINS || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_PARENT_ORIGINS;
})();

export function isAllowedParentOrigin(origin: string): boolean {
  return allowedParentOrigins.includes(normalizeOrigin(origin || ""));
}

export function getAllowedParentOrigins(): string[] {
  return [...allowedParentOrigins];
}
