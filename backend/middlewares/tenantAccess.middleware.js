import { assertTenantAccess } from "../services/tenantAccess.service.js";

function pickTenantId(req, source) {
  if (source === "params") return req.params.tenantId;
  if (source === "query") return req.query.tenantId;
  if (source === "body") return req.body?.tenantId;
  return req.params.tenantId || req.query.tenantId || req.body?.tenantId;
}

/**
 * requireTenantAccess(source)
 * source: "params" | "query" | "body" | "any"
 */
export function requireTenantAccess(source = "any") {
  return async (req, res, next) => {
    try {
      const tenantId = pickTenantId(req, source);
      await assertTenantAccess(req.user, tenantId);
      next();
    } catch (err) {
      next(err);
    }
  };
}
