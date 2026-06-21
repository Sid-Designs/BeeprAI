"use client";

import type {
  Agent,
  BeeprUser,
  BulkCampaign,
  BulkCampaignContact,
  BulkCampaignGroupType,
  Appointment,
  CalendarSlot,
  TenantCalendarSettings,
  CallAnalysis,
  CallAnalysisListOptions,
  KbGapClusterReport,
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  LeadOutcomeLive,
  Organization,
  TelephonyConfig,
  Tenant,
  TenantAnalyticsSummary,
  TenantUsage,
} from "@/lib/types";
import { clearAuthSession, getAccessToken, setAccessToken } from "@/lib/auth";

type ApiResponse<T> = { success: boolean; data: T; message?: string };

/**
 * Attempts to silently refresh the access token using the HttpOnly refresh
 * cookie. Returns the new access token on success, or null on failure.
 * Guarded so it is never called recursively from itself.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/backend/auth/refresh", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.data?.accessToken) {
        setAccessToken(payload.data.accessToken as string);
        return payload.data.accessToken as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`/api/backend${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  // Access token expired — try one silent refresh, then replay the request once.
  if (
    response.status === 401 &&
    payload?.code === "TOKEN_EXPIRED" &&
    !isRetry &&
    path !== "/auth/refresh"
  ) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, init, true);
    }
    // Refresh failed — session is dead. Clean up so guards send user to login.
    clearAuthSession();
  }

  if (!response.ok || payload?.success === false) {
    const error = new Error(
      payload?.message || payload?.error || `Request failed: ${response.status}`,
    ) as Error & { code?: string; status?: number };
    error.code = payload?.code;
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

export const api = {
  health: () => request<{ success: boolean; message?: string }>("/health"),

  // ─── Authentication ─────────────────────────────────────────────────────────
  register: (body: { fullName: string; email: string; phone: string; password: string }) =>
    request<ApiResponse<{ user: BeeprUser }>>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    request<ApiResponse<{ accessToken: string; user: BeeprUser }>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyEmail: (token: string) =>
    request<{ success: boolean; message?: string }>(
      `/auth/verify-email/${encodeURIComponent(token)}`,
    ),

  resendVerification: (body: { email: string }) =>
    request<{ success: boolean; message?: string }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  forgotPassword: (body: { email: string }) =>
    request<{ success: boolean; message?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resetPassword: (token: string, body: { password: string; confirmPassword: string }) =>
    request<{ success: boolean; message?: string }>(
      `/auth/reset-password/${encodeURIComponent(token)}`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  logout: () =>
    request<{ success: boolean; message?: string }>("/auth/logout", { method: "POST" }),

  me: () => request<ApiResponse<{ user: BeeprUser }>>("/auth/me"),

  getProfile: () => request<ApiResponse<{ user: BeeprUser }>>("/user/profile"),

  updateProfile: (body: { fullName?: string; phone?: string }) =>
    request<ApiResponse<{ user: BeeprUser }>>("/user/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    request<ApiResponse<unknown>>("/user/change-password", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getPaymentConfig: () =>
    request<ApiResponse<import("@/lib/planCheckout").PaymentConfigResponse>>("/payments/config"),

  createPaymentOrder: (body: { tenantId: string; plan: "pro" | "enterprise" }) =>
    request<
      ApiResponse<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        plan: string;
        planLabel: string;
      }>
    >("/payments/create-order", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyPayment: (body: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) =>
    request<ApiResponse<{ plan: string; alreadyPaid?: boolean }>>("/payments/verify", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // ─── Organization ─────────────────────────────────────────────────────────────
  createOrganization: (body: { name: string; industry?: string }) =>
    request<ApiResponse<{ organization: Organization }>>("/organization", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getOrganization: () =>
    request<ApiResponse<{ organization: Organization }>>("/organization"),

  registerTenant: (body: { orgName: string; industry: string }) =>
    request<{ success: boolean; data: Tenant; usage?: TenantUsage; telephony?: TelephonyConfig }>(
      "/tenant/register",
      { method: "POST", body: JSON.stringify(body) },
    ),

  getTenant: (tenantId: string) =>
    request<{ success: boolean; data: Tenant; usage?: TenantUsage; telephony?: TelephonyConfig }>(
      `/tenant/${tenantId}`,
    ),

  getMyTenant: () =>
    request<{ success: boolean; data: Tenant; usage?: TenantUsage; telephony?: TelephonyConfig }>(
      "/tenant/mine",
    ),

  createAgent: (body: {
    tenantId: string;
    name: string;
    type: string;
    tone: string;
    script: string;
    callConfig: Record<string, unknown>;
    faqs?: { question: string; answer: string }[];
  }) => request<ApiResponse<Agent>>("/agent/create", { method: "POST", body: JSON.stringify(body) }),

  listAgents: (tenantId: string) =>
    request<{ success: boolean; count: number; data: Agent[] }>(`/agent/list/${tenantId}`),

  addKbText: (body: { tenantId: string; agentId: string; text: string }) =>
    request<{ success: boolean; totalChunks: number; message?: string }>("/kb/text", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  addKbUrl: (body: { tenantId: string; agentId: string; urls: string[] }) =>
    request<{ success: boolean; totalChunks: number; message?: string }>("/kb/url", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  addKbPdf: (body: FormData) =>
    request<{ success: boolean; totalChunks: number; message?: string }>("/kb/pdf", {
      method: "POST",
      body,
    }),

  queryKb: (body: { tenantId: string; agentId: string; query: string }) =>
    request<{ success: boolean; context: unknown[] }>("/kb/query", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listKbDocuments: (tenantId: string, agentId: string) =>
    request<{ success: boolean; count: number; data: KnowledgeDocument[] }>(
      `/kb/documents/${encodeURIComponent(tenantId)}/${encodeURIComponent(agentId)}`,
    ),

  getKbDocument: (tenantId: string, agentId: string, docId: string) =>
    request<{ success: boolean; data: KnowledgeDocumentDetail }>(
      `/kb/documents/${encodeURIComponent(tenantId)}/${encodeURIComponent(agentId)}/${encodeURIComponent(docId)}`,
    ),

  deleteKbDocument: (body: { tenantId: string; agentId: string; docId: string }) =>
    request<{ success: boolean; message?: string; deletedChunks?: number }>("/kb/documents", {
      method: "DELETE",
      body: JSON.stringify(body),
    }),

  updateKbText: (body: {
    tenantId: string;
    agentId: string;
    docId: string;
    text: string;
    title?: string;
  }) =>
    request<{ success: boolean; totalChunks: number; message?: string }>("/kb/text/update", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  updateKbUrl: (body: {
    tenantId: string;
    agentId: string;
    docId: string;
    url?: string;
  }) =>
    request<{ success: boolean; totalChunks: number; message?: string; sourceUrl?: string }>(
      "/kb/url/update",
      { method: "PUT", body: JSON.stringify(body) },
    ),

  updateKbPdf: (body: FormData) =>
    request<{ success: boolean; totalChunks: number; message?: string }>("/kb/pdf/update", {
      method: "PUT",
      body,
    }),

  startCall: (body: {
    tenantId: string;
    agentId: string;
    receiverNumber: string;
    triggerOutboundCall: boolean;
    autoJoinCaller: boolean;
    callObjective: string;
    callConfig: Record<string, unknown>;
  }) =>
    request<{
      success: boolean;
      data: {
        sessionId?: string;
        roomName?: string;
        status?: string;
        callerNumber?: string;
        usage?: TenantUsage;
      };
    }>("/call/sip/start", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCallAnalysis: (tenantId: string, options: CallAnalysisListOptions = {}) => {
    const params = new URLSearchParams({ tenantId });
    if (options.agentId) params.set("agentId", options.agentId);
    if (options.limit != null) params.set("limit", String(options.limit));
    if (options.skip != null) params.set("skip", String(options.skip));
    return request<{ success: boolean; count: number; data: CallAnalysis[] }>(
      `/call-analysis/list?${params.toString()}`,
    );
  },

  getTenantAnalytics: (tenantId: string) =>
    request<{ success: boolean; data: TenantAnalyticsSummary }>(
      `/call-analysis/analytics/summary?tenantId=${encodeURIComponent(tenantId)}`,
    ),

  getCallAnalysis: (sessionId: string) =>
    request<{ success: boolean; data: CallAnalysis }>(`/call-analysis/${sessionId}`),

  getLiveCallStatus: (sessionId: string) =>
    request<{ success: boolean; data: LeadOutcomeLive }>(`/call-analysis/live/${sessionId}`),

  getKbGapClusters: (
    tenantId: string,
    options: { agentId?: string; windowHours?: number } = {},
  ) => {
    const params = new URLSearchParams({ tenantId });
    if (options.agentId) params.set("agentId", options.agentId);
    if (options.windowHours != null) params.set("windowHours", String(options.windowHours));
    return request<{ success: boolean; data: KbGapClusterReport }>(
      `/call-analysis/kb-gaps?${params.toString()}`,
    );
  },

  getCalendarSettings: (tenantId: string) =>
    request<{ success: boolean; data: TenantCalendarSettings }>(
      `/tenant/${encodeURIComponent(tenantId)}/calendar/settings`,
    ),

  putCalendarSettings: (tenantId: string, body: Partial<TenantCalendarSettings>) =>
    request<{ success: boolean; data: TenantCalendarSettings }>(
      `/tenant/${encodeURIComponent(tenantId)}/calendar/settings`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  listCalendarAppointments: (tenantId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString();
    return request<{ success: boolean; count: number; data: Appointment[] }>(
      `/tenant/${encodeURIComponent(tenantId)}/calendar/appointments${query ? `?${query}` : ""}`,
    );
  },

  getCalendarAvailability: (tenantId: string, date: string) =>
    request<{ success: boolean; count: number; data: CalendarSlot[] }>(
      `/tenant/${encodeURIComponent(tenantId)}/calendar/availability?date=${encodeURIComponent(date)}`,
    ),

  createCalendarAppointment: (
    tenantId: string,
    body: {
      customerName?: string;
      customerPhone?: string;
      startAt: string;
      endAt: string;
      notes?: string;
      sessionId?: string;
    },
  ) =>
    request<{ success: boolean; data: Appointment }>(
      `/tenant/${encodeURIComponent(tenantId)}/calendar/appointments`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  patchAppointment: (
    appointmentId: string,
    body: Partial<Pick<Appointment, "status" | "startAt" | "endAt" | "customerName" | "customerPhone" | "notes">>,
  ) =>
    request<{ success: boolean; data: Appointment }>(`/appointments/${appointmentId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  getBulkGroupTypes: () =>
    request<{ success: boolean; data: Record<string, string> }>("/bulk-campaigns/group-types"),

  listBulkCampaigns: (tenantId: string) =>
    request<{ success: boolean; data: BulkCampaign[] }>(
      `/bulk-campaigns/list?tenantId=${encodeURIComponent(tenantId)}`,
    ),

  createBulkCampaign: (body: {
    tenantId: string;
    name: string;
    groupType: BulkCampaignGroupType;
    agentId: string;
    callObjective?: string;
    delayBetweenCallsSec?: number;
  }) =>
    request<{ success: boolean; data: BulkCampaign }>("/bulk-campaigns/create", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getBulkCampaign: (campaignId: string) =>
    request<{ success: boolean; data: BulkCampaign }>(`/bulk-campaigns/${campaignId}`),

  listBulkCampaignContacts: (campaignId: string) =>
    request<{ success: boolean; data: BulkCampaignContact[] }>(
      `/bulk-campaigns/${campaignId}/contacts`,
    ),

  addBulkCampaignContacts: (
    campaignId: string,
    body: { manualText?: string; contacts?: { name?: string; phoneNumber: string }[] },
  ) =>
    request<{
      success: boolean;
      data: { added: number; skipped: number; stats: BulkCampaign["stats"] };
    }>(`/bulk-campaigns/${campaignId}/contacts`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  uploadBulkCampaignContacts: (campaignId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{
      success: boolean;
      data: { added: number; skipped: number; parsed: number; stats: BulkCampaign["stats"] };
    }>(`/bulk-campaigns/${campaignId}/contacts/upload`, {
      method: "POST",
      body: form,
    });
  },

  startBulkCampaign: (campaignId: string) =>
    request<{ success: boolean; data: BulkCampaign }>(`/bulk-campaigns/${campaignId}/start`, {
      method: "POST",
    }),

  pauseBulkCampaign: (campaignId: string) =>
    request<{ success: boolean; data: BulkCampaign }>(`/bulk-campaigns/${campaignId}/pause`, {
      method: "POST",
    }),

  cancelBulkCampaign: (campaignId: string) =>
    request<{ success: boolean; data: BulkCampaign }>(`/bulk-campaigns/${campaignId}/cancel`, {
      method: "POST",
    }),

  deleteBulkCampaign: (campaignId: string) =>
    request<{ success: boolean; data: { deleted: boolean } }>(`/bulk-campaigns/${campaignId}`, {
      method: "DELETE",
    }),

  removeBulkCampaignContact: (campaignId: string, contactId: string) =>
    request<{ success: boolean; data: BulkCampaignContact }>(
      `/bulk-campaigns/${campaignId}/contacts/${contactId}`,
      { method: "DELETE" },
    ),

  clearPendingBulkContacts: (campaignId: string) =>
    request<{ success: boolean; data: { removed: number } }>(
      `/bulk-campaigns/${campaignId}/contacts/pending`,
      { method: "DELETE" },
    ),

  adminTenants: () =>
    request<{ success: boolean; count: number; data: (Tenant & { usageSummary?: TenantUsage })[] }>(
      "/admin/tenants",
    ),

  adminAgents: () => request<{ success: boolean; count: number; data: Agent[] }>("/admin/agents"),

  adminCalls: () =>
    request<{ success: boolean; count: number; data: CallAnalysis[] }>("/admin/call-analysis"),
};
