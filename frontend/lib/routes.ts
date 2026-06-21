export type RouteZone = "marketing" | "auth" | "onboarding" | "dashboard" | "app";

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/welcome",
  "/checkout",
]);

export function getRouteZone(pathname: string): RouteZone {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "dashboard";
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (AUTH_PATHS.has(pathname)) return "auth";
  if (pathname.startsWith("/admin")) return "app";
  return "marketing";
}
