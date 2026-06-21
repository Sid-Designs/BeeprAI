import {
  bookAppointment,
  getAvailableSlots,
  listAppointments,
  updateAppointment,
  getAppointmentById,
} from "../services/calendar/availability.service.js";
import {
  getCalendarSettings,
  upsertCalendarSettings,
} from "../services/calendar/calendarSettings.service.js";
import { assertTenantAccess } from "../services/tenantAccess.service.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const getSettings = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    await assertTenantAccess(req.user, tenantId);
    const data = await getCalendarSettings(tenantId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const putSettings = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    await assertTenantAccess(req.user, tenantId);
    const data = await upsertCalendarSettings(tenantId, req.body || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const getAppointments = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { from, to, includeCancelled } = req.query;
    await assertTenantAccess(req.user, tenantId);

    const data = await listAppointments(tenantId, {
      from,
      to,
      includeCancelled: String(includeCancelled || "").toLowerCase() === "true",
    });

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return next(error);
  }
};

export const getAvailability = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { date } = req.query;

    if (!date || !DATE_RE.test(String(date))) {
      return res.status(400).json({
        success: false,
        message: "date query param is required (YYYY-MM-DD)",
      });
    }

    await assertTenantAccess(req.user, tenantId);
    const data = await getAvailableSlots(tenantId, String(date));

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return next(error);
  }
};

export const createAppointment = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    await assertTenantAccess(req.user, tenantId);

    const {
      sessionId,
      customerName,
      customerPhone,
      startAt,
      endAt,
      notes,
      createdBy,
      status,
    } = req.body || {};

    const data = await bookAppointment({
      tenantId,
      sessionId,
      customerName,
      customerPhone,
      startAt,
      endAt,
      notes,
      createdBy: createdBy || "manual",
      status: status || "scheduled",
    });

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

export const patchAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.params;
    const existing = await getAppointmentById(appointmentId);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    await assertTenantAccess(req.user, existing.tenantId);

    const data = await updateAppointment(appointmentId, existing.tenantId, req.body || {});
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};
