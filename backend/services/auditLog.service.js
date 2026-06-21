import AuditLog from "../models/auditLog.model.js";

export function log({
  organizationId = null,
  actorId = null,
  actorRole = "",
  action,
  resourceType = "",
  resourceId = "",
  ipAddress = "",
  userAgent = "",
  metadata = {},
  success = true,
}) {
  AuditLog.create({
    organizationId,
    actorId,
    actorRole,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    metadata,
    success,
  }).catch((err) => {
    console.error("[auditLog] Failed to write audit log:", err.message);
  });
}
