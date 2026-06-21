export type Plan = "free" | "pro" | "enterprise";

export type UserRole = "owner" | "admin" | "agentManager" | "viewer";

export type BeeprUser = {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  isEmailVerified: boolean;
  isPlatformAdmin?: boolean;
  organizationId: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
};

export type Organization = {
  _id: string;
  name: string;
  slug: string;
  industry?: string;
  plan: Plan;
  ownerId: string;
  usageLimits?: {
    maxCallsPerMonth?: number;
    maxAgents?: number;
  };
  usage?: {
    callsUsed?: number;
    agentsUsed?: number;
  };
  createdAt?: string;
};

export type Tenant = {
  _id: string;
  orgName: string;
  slug: string;
  industry: string;
  plan: Plan;
  organizationId?: string;
  createdAt?: string;
  usageLimits?: {
    maxCallsPerMonth?: number;
    maxAgents?: number;
  };
  usage?: {
    callsUsed?: number;
    agentsUsed?: number;
  };
};

export type TenantUsage = {
  plan?: Plan;
  usageLimits?: {
    maxCallsPerMonth?: number;
    maxAgents?: number;
  };
  usage?: {
    callsUsed?: number;
    agentsUsed?: number;
  };
  callsRemaining?: number;
  agentsRemaining?: number;
};

export type TelephonyConfig = {
  provider?: string;
  defaultCallerNumber?: string;
  callerNumberConfigurable?: boolean;
  configured?: boolean;
};

export type AgentType = "support" | "sales" | "appointment" | "custom";

export type Agent = {
  _id: string;
  tenantId: string;
  name: string;
  type: AgentType;
  tone?: string;
  script?: string;
  prompt?: string;
  isActive?: boolean;
  createdAt?: string;
  callConfig?: {
    objective?: string;
    reasonForCalling?: string;
    primaryGoal?: string;
    openingScript?: string;
    qualificationFields?: string[];
    allowHandoff?: boolean;
    allowAppointmentBooking?: boolean;
    businessContext?: string;
  };
};

export type TranscriptTurn = {
  speaker: "user" | "assistant";
  timestamp: string;
  message: string;
  turnIndex?: number;
};

export type CallOutcome =
  | "appointment_booked"
  | "callback_scheduled"
  | "qualified_lead"
  | "information_provided"
  | "not_interested"
  | "abandoned"
  | "unanswered"
  | "unknown";

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type IntentInsight = {
  primaryIntent?: string;
  confidence?: number;
  intent?: string;
  subTopics?: string[];
};

export type CallAnalysis = {
  _id?: string;
  sessionId: string;
  callId?: string;
  roomName?: string;
  tenantId: string;
  agentId: string;
  phoneNumber?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  summary?: string;
  primaryIntent?: string;
  secondaryIntents?: string[];
  outcome?: CallOutcome | string;
  leadScore?: number;
  sentiment?: "positive" | "neutral" | "negative";
  objections?: string[];
  collectedInformation?: Record<string, unknown>;
  appointmentBooked?: boolean;
  appointmentDate?: string;
  appointmentTime?: string;
  nextAction?: string;
  transcript?: TranscriptTurn[];
  analysisStatus?: AnalysisStatus;
  analysisSource?: "llm" | "rules" | "hybrid";
  endReason?: string;
  triggerSource?: string;
  metadata?: Record<string, unknown>;
  insights?: string[];
  appointmentId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadOutcomeLive = {
  sessionId: string;
  tenantId: string;
  agentId: string;
  roomName?: string;
  stage: string;
  leadStatus: string;
  turnCount: number;
  lastUserMessage: string;
  lastAssistantMessage: string;
  collectedData: Record<string, unknown>;
  isClosed: boolean;
  objective?: string;
  endReason?: string;
  intentInsight?: IntentInsight;
  updatedAt?: string;
};

export type WorkingHoursEntry = {
  day: number;
  start: string;
  end: string;
  enabled?: boolean;
};

export type TenantCalendarSettings = {
  tenantId?: string;
  timezone: string;
  workingHours: WorkingHoursEntry[];
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxDailyAppointments?: number | null;
  blackoutDates?: string[];
};

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"
  | "hold";

export type Appointment = {
  _id: string;
  tenantId: string;
  sessionId?: string;
  customerName?: string;
  customerPhone?: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes?: string;
  createdBy?: "ai_agent" | "manual";
  createdAt?: string;
  updatedAt?: string;
};

export type CalendarSlot = {
  startAt: string;
  endAt: string;
};

export type BulkCampaignGroupType = "cold_calling" | "appointment" | "follow_up" | "custom";

export type BulkCampaignStatus = "draft" | "running" | "paused" | "completed" | "cancelled";

export type BulkCampaignContactStatus =
  | "pending"
  | "calling"
  | "completed"
  | "failed"
  | "skipped";

export type BulkCampaign = {
  _id: string;
  tenantId: string;
  name: string;
  groupType: BulkCampaignGroupType;
  agentId: string;
  callObjective?: string;
  status: BulkCampaignStatus;
  delayBetweenCallsSec?: number;
  stats?: {
    total?: number;
    pending?: number;
    calling?: number;
    completed?: number;
    failed?: number;
    skipped?: number;
  };
  lastError?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
};

export type BulkCampaignContact = {
  _id: string;
  campaignId: string;
  name?: string;
  phoneNumber: string;
  status: BulkCampaignContactStatus;
  sessionId?: string;
  lastError?: string;
  calledAt?: string;
  completedAt?: string;
};

export type KbGapCluster = {
  id: string;
  label: string;
  signalCount: number;
  kbGateCount: number;
  abandonedCount: number;
  unansweredCount: number;
  sampleQueries: string[];
  sampleSessionIds: string[];
  recommendedAction: string;
};

export type KbGapRecommendation = {
  topic: string;
  action: string;
  signalCount: number;
};

export type KbGapClusterReport = {
  generatedAt: string;
  windowHours: number;
  tenantId: string;
  agentId: string;
  totalSignals: number;
  clusterCount: number;
  clusters: KbGapCluster[];
  recommendations: KbGapRecommendation[];
};

export type CallAnalysisListOptions = {
  agentId?: string;
  limit?: number;
  skip?: number;
};

export type TenantAnalyticsSummary = {
  tenantId: string;
  periodDays: number;
  totalCalls: number;
  callsToday: number;
  successRate: number;
  conversionRate: number;
  avgCallDurationSeconds: number;
  topPerformer: { agentId: string; name: string; calls: number } | null;
  activeAgents: number;
  knowledgeSourceCount: number;
  dailyVolume: { label: string; count: number }[];
  dailyBarHeights: number[];
};

export type KnowledgeSourceType = "text" | "pdf" | "url";

export type KnowledgeDocument = {
  docId: string;
  sourceType: KnowledgeSourceType;
  sourceUrl?: string;
  title: string;
  chunkCount: number;
  preview?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type KnowledgeDocumentDetail = KnowledgeDocument & {
  text: string;
};
