import type { UserRole } from "@/lib/types";

const TENANT_KEY = "beepr.tenant.id";
const ADMIN_KEY = "beepr.admin.unlocked";
const AUTH_KEY = "beepr.auth.session";
const AUTH_EVENT = "beepr:auth-change";
const TOKEN_KEY = "beepr.auth.token";
const ONBOARDING_KEY = "beepr.onboarding.state";

function getOnboardingStorageKey(userId?: string | null): string {
  if (userId) return `${ONBOARDING_KEY}.${userId}`;
  return ONBOARDING_KEY;
}

export type AuthSession = {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  organizationId: string | null;
  verified: boolean;
  isPlatformAdmin: boolean;
  createdAt: string;
};

export type OnboardingState = {
  welcomeSeen: boolean;
  workspaceCompleted: boolean;
  agentCompleted: boolean;
  calendarCompleted: boolean;
  knowledgeCompleted: boolean;
  testCompleted: boolean;
  firstCallCompleted: boolean;
  onboardingSkipped: boolean;
  workspaceName: string;
  industry: string;
  teamSize: string;
  agentId: string;
  agentName: string;
};

export type OnboardingStepKey =
  | "workspaceCompleted"
  | "agentCompleted"
  | "calendarCompleted"
  | "knowledgeCompleted"
  | "testCompleted"
  | "firstCallCompleted";

const defaultOnboardingState: OnboardingState = {
  welcomeSeen: false,
  workspaceCompleted: false,
  agentCompleted: false,
  calendarCompleted: false,
  knowledgeCompleted: false,
  testCompleted: false,
  firstCallCompleted: false,
  onboardingSkipped: false,
  workspaceName: "",
  industry: "",
  teamSize: "",
  agentId: "",
  agentName: "",
};

const onboardingStepRoutes: Array<{
  path: string;
  completed: OnboardingStepKey;
}> = [
  { path: "/onboarding/workspace", completed: "workspaceCompleted" },
  { path: "/onboarding/agent", completed: "agentCompleted" },
  { path: "/onboarding/calendar", completed: "calendarCompleted" },
  { path: "/onboarding/knowledge", completed: "knowledgeCompleted" },
  { path: "/onboarding/test", completed: "testCompleted" },
  { path: "/onboarding/first-call", completed: "firstCallCompleted" },
];

function parseStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

const TENANT_EVENT = "beepr:tenant-change";

export function getTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TENANT_KEY);
}

export function setTenantId(tenantId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TENANT_KEY, tenantId);
  window.dispatchEvent(new Event(TENANT_EVENT));
}

export function clearTenantId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TENANT_KEY);
  window.dispatchEvent(new Event(TENANT_EVENT));
}

export function getTenantIdSnapshot(): string | null {
  return getTenantId();
}

export function getServerTenantIdSnapshot(): string | null {
  return null;
}

export function subscribeTenantId(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(TENANT_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TENANT_EVENT, callback);
  };
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  _sessionRaw = null;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/**
 * Cached snapshot of the auth session for use with React's
 * useSyncExternalStore. Caches by the raw stored string so the returned
 * object identity is stable between renders (prevents render loops).
 */
let _sessionRaw: string | null = null;
let _sessionCache: AuthSession | null = null;

export function getAuthSessionSnapshot(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_KEY);
  if (raw === _sessionRaw) return _sessionCache;
  _sessionRaw = raw;
  try {
    _sessionCache = raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    _sessionCache = null;
  }
  return _sessionCache;
}

export function getServerAuthSessionSnapshot(): AuthSession | null {
  return null;
}

export function subscribeAuthSession(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_EVENT, callback);
  };
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getOnboardingState(userId?: string | null): OnboardingState {
  const id = userId ?? getAuthSession()?.userId;
  return parseStorage(getOnboardingStorageKey(id), defaultOnboardingState);
}

export function setOnboardingState(state: OnboardingState, userId?: string | null) {
  if (typeof window === "undefined") return;
  const id = userId ?? getAuthSession()?.userId;
  window.localStorage.setItem(getOnboardingStorageKey(id), JSON.stringify(state));
}

export function updateOnboardingState(patch: Partial<OnboardingState>, userId?: string | null) {
  const id = userId ?? getAuthSession()?.userId;
  const previous = getOnboardingState(id);
  setOnboardingState({ ...previous, ...patch }, id);
}

export function resetOnboardingState(userId?: string | null) {
  const id = userId ?? getAuthSession()?.userId;
  setOnboardingState(defaultOnboardingState, id);
  clearTenantId();
}

/** Returning users with an existing workspace should not repeat guided onboarding. */
export function markOnboardingCompleteForReturningUser(
  patch: Partial<OnboardingState> = {},
  userId?: string | null,
) {
  updateOnboardingState(
    {
      workspaceCompleted: true,
      agentCompleted: true,
      calendarCompleted: true,
      knowledgeCompleted: true,
      testCompleted: true,
      firstCallCompleted: true,
      onboardingSkipped: true,
      ...patch,
    },
    userId,
  );
}

export function isOnboardingComplete(state = getOnboardingState(getAuthSession()?.userId)): boolean {
  if (state.onboardingSkipped) return true;
  return Boolean(
    state.workspaceCompleted &&
      state.agentCompleted &&
      state.calendarCompleted &&
      state.knowledgeCompleted &&
      state.testCompleted &&
      state.firstCallCompleted,
  );
}

export function skipOnboardingStep(stepKey: OnboardingStepKey) {
  updateOnboardingState({ [stepKey]: true });
}

export function skipEntireOnboarding() {
  updateOnboardingState({ onboardingSkipped: true });
}

export function getOnboardingPostAuthRoute(state = getOnboardingState(getAuthSession()?.userId)): string {
  return isOnboardingComplete(state) ? "/dashboard" : getNextOnboardingRoute(state);
}

export function getNextOnboardingRoute(state = getOnboardingState(getAuthSession()?.userId)): string {
  const next = onboardingStepRoutes.find((step) => !state[step.completed]);
  return next?.path ?? "/dashboard";
}

export function getOnboardingRouteIndex(pathname: string): number {
  return onboardingStepRoutes.findIndex((step) => pathname.startsWith(step.path));
}

export function getNextOnboardingRouteIndex(state = getOnboardingState(getAuthSession()?.userId)): number {
  return onboardingStepRoutes.findIndex((step) => !state[step.completed]);
}

const ADMIN_EVENT = "beepr:admin-unlock-change";

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ADMIN_KEY) === "true";
}

export function setAdminUnlocked(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_KEY, value ? "true" : "false");
  window.dispatchEvent(new Event(ADMIN_EVENT));
}

export function getAdminUnlockedSnapshot(): boolean {
  return isAdminUnlocked();
}

export function getServerAdminUnlockedSnapshot(): boolean {
  return false;
}

export function subscribeAdminUnlocked(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(ADMIN_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ADMIN_EVENT, callback);
  };
}
