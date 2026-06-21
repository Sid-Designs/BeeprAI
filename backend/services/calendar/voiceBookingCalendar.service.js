import { AppError } from "../../utils/AppError.js";
import { bookAppointment, isSlotAvailable } from "./availability.service.js";
import { getCalendarSettings } from "./calendarSettings.service.js";
import {
  matchSlotFromPreferences,
  formatSlotLabel,
  resolveDateString,
  pickNearestSlot,
  matchOfferedSlotSelection,
} from "./voiceBookingCalendar.helpers.js";
import {
  evaluateBookingProgress,
  resolveBookingTurn,
  buildBookingProgressAck,
  isBookingAffirmation,
  detectBookingDateChange,
  clearBookingSlotState,
  mergeSplitBookingDate,
  isScheduleReadyForConfirm,
  formatBookingScheduleLabel,
} from "../conversation/bookingFlow.service.js";
import { extractIndicDateTime } from "../conversation/indicDateTime.service.js";

export {
  resolveDateString,
  parsePreferredTimeToMinutes,
  matchSlotFromPreferences,
  addDaysInTimeZone,
} from "./voiceBookingCalendar.helpers.js";

const buildAlternativesReply = (slots, timeZone, language = "en", { includeAck = false } = {}) => {
  const labels = slots.slice(0, 3).map((slot) => formatSlotLabel(slot, timeZone)).join(", ");
  const ack = includeAck ? `${buildBookingProgressAck({ language, phase: "checking" })} ` : "";
  if (language === "hi") {
    return `${ack}वह समय उपलब्ध नहीं है। मैं ${labels} offer कर सकता हूँ। कौन सा समय ठीक रहेगा?`;
  }
  return `${ack}That exact time isn't open. I can offer ${labels}. Which works best?`;
};

const assignSlotToCollected = (collected = {}, slot, timeZone) => {
  if (!slot) return collected;
  const slotLabel = formatSlotLabel(slot, timeZone);
  const next = {
    ...collected,
    appointmentSlotStart: slot.startAt,
    appointmentSlotEnd: slot.endAt,
    preferred_time: slotLabel,
  };
  const scheduleText = formatBookingScheduleLabel(next, timeZone);
  return {
    ...next,
    appointmentSchedule: {
      ...(collected.appointmentSchedule || {}),
      preferredTime: slotLabel,
      text: scheduleText,
    },
  };
};

export const confirmVoiceBooking = async ({
  tenantId,
  sessionId,
  customerName = "",
  customerPhone = "",
  collectedData = {},
}) => {
  if (!tenantId) {
    throw new AppError("tenantId is required for booking", 400, "TENANT_REQUIRED");
  }

  let startAt = collectedData.appointmentSlotStart;
  let endAt = collectedData.appointmentSlotEnd;

  if (!startAt || !endAt) {
    const match = await matchSlotFromPreferences(tenantId, collectedData);
    const calendarSettings = await getCalendarSettings(tenantId);
    const tz = calendarSettings?.timezone || "UTC";
    const slot =
      match?.matched || pickNearestSlot(match?.slots || [], collectedData.preferred_time, tz);
    if (!slot) {
      throw new AppError("Requested slot is not available", 409, "SLOT_UNAVAILABLE");
    }
    startAt = slot.startAt;
    endAt = slot.endAt;
  } else {
    const available = await isSlotAvailable(tenantId, startAt, endAt);
    if (!available) {
      throw new AppError("Requested slot is not available", 409, "SLOT_UNAVAILABLE");
    }
  }

  return bookAppointment({
    tenantId,
    sessionId,
    customerName,
    customerPhone,
    startAt,
    endAt,
    createdBy: "ai_agent",
    status: "confirmed",
  });
};

export const resolveVoiceBookingTurn = async ({
  tenantId,
  sessionId,
  customerPhone = "",
  state,
  extractedData,
  query,
  policy,
  language,
  intentProfile,
  mergeCollectedDataFn,
}) => {
  const stageLower = String(state.stage || "").toLowerCase();
  const settings = tenantId ? await getCalendarSettings(tenantId) : null;
  const timeZone = settings?.timezone || "UTC";

  let mergedPreview = mergeCollectedDataFn(state.collectedData, {
    ...extractedData,
    appointmentRequested: true,
  });
  mergedPreview = mergeSplitBookingDate(mergedPreview, query, extractedData);

  const dateChange = detectBookingDateChange(
    query,
    state.collectedData || {},
    { ...extractedData, ...extractIndicDateTime(query) },
  );
  if (dateChange.clearSlots) {
    mergedPreview = clearBookingSlotState(mergedPreview);
  }

  const offeredSlots = Array.isArray(mergedPreview.offeredSlots) ? mergedPreview.offeredSlots : [];
  const selectedOffered = matchOfferedSlotSelection(query, offeredSlots, timeZone);
  if (selectedOffered) {
    mergedPreview = assignSlotToCollected(mergedPreview, selectedOffered, timeZone);
    mergedPreview.offeredSlots = [];
    mergedPreview.alternativesOffered = false;
  }

  const progress = evaluateBookingProgress({
    collectedData: mergedPreview,
    extractedData,
    query,
    policy,
  });
  const confirming =
    isBookingAffirmation(query) &&
    (stageLower === "confirmation" || isScheduleReadyForConfirm(mergedPreview));

  let slotMatch = null;
  if (tenantId && progress.hasDate && (progress.hasTime || stageLower === "confirmation" || confirming)) {
    slotMatch = await matchSlotFromPreferences(tenantId, mergedPreview);
  }

  if (
    tenantId &&
    slotMatch?.slots?.length &&
    !slotMatch.matched &&
    progress.allRequiredFilled &&
    !confirming
  ) {
    const nearest = pickNearestSlot(slotMatch.slots, mergedPreview.preferred_time, timeZone);
    if (nearest) {
      mergedPreview = assignSlotToCollected(mergedPreview, nearest, timeZone);
      slotMatch = { ...slotMatch, matched: nearest };
    }
  }

  const bookingResult = resolveBookingTurn({
    state: {
      ...state,
      collectedData: mergedPreview,
    },
    extractedData,
    query,
    policy,
    language,
    intentProfile,
    mergeCollectedDataFn,
  });

  let answer = bookingResult.answer;
  let nextCollected = { ...(bookingResult.nextState.collectedData || {}) };

  if (slotMatch?.dateStr) {
    nextCollected.resolvedDate = slotMatch.dateStr;
    nextCollected.availableSlotCount = slotMatch.slots.length;
  }

  if (slotMatch?.matched) {
    nextCollected = assignSlotToCollected(nextCollected, slotMatch.matched, timeZone);
  }

  const alreadyOfferedAlternatives = Boolean(nextCollected.alternativesOffered);
  const shouldShowAlternatives =
    !confirming &&
    !bookingResult.endCall &&
    bookingResult.stage === "appointment_booking" &&
    slotMatch?.dateStr &&
    mergedPreview.preferred_time &&
    !slotMatch.matched &&
    slotMatch.slots.length > 0 &&
    !alreadyOfferedAlternatives;

  if (slotMatch?.dateStr && !slotMatch.slots.length && bookingResult.stage === "appointment_booking") {
    const preferredDate = mergedPreview.preferred_date || mergedPreview.timeline;
    const resolved = resolveDateString(preferredDate, timeZone);
    const isPastDate = !resolved && Boolean(String(preferredDate || "").trim());
    answer = isPastDate
      ? language === "hi"
        ? "वह तारीख बीत चुकी है। कृपया आज या आगे की कोई तारीख बताइए।"
        : "That date has already passed. Please share a date from today onward."
      : language === "hi"
        ? "उस तारीख पर कोई slot उपलब्ध नहीं है। क्या कोई और तारीख काम करेगी?"
        : "I don't have any open slots on that date. Would another day work for you?";
  } else if (shouldShowAlternatives) {
    answer = buildAlternativesReply(slotMatch.slots, timeZone, language, { includeAck: true });
    nextCollected.offeredSlots = slotMatch.slots.slice(0, 3);
    nextCollected.alternativesOffered = true;
  }

  let nextState = {
    ...bookingResult.nextState,
    collectedData: nextCollected,
  };

  if (bookingResult.endCall && bookingResult.endReason === "appointment_confirmed" && tenantId) {
    try {
      const appointment = await confirmVoiceBooking({
        tenantId,
        sessionId,
        customerName: nextCollected.name || "",
        customerPhone,
        collectedData: nextCollected,
      });
      nextCollected.appointmentId = String(appointment._id);
      nextCollected.appointmentConfirmed = true;
      nextState = {
        ...nextState,
        collectedData: nextCollected,
        bookingStatus: "completed",
      };
    } catch {
      const retryMatch = await matchSlotFromPreferences(tenantId, nextCollected);
      const fallbackSlot =
        pickNearestSlot(retryMatch.slots, nextCollected.preferred_time, timeZone) ||
        retryMatch.slots[0] ||
        null;

      if (fallbackSlot) {
        nextCollected = assignSlotToCollected(nextCollected, fallbackSlot, timeZone);
        try {
          const appointment = await confirmVoiceBooking({
            tenantId,
            sessionId,
            customerName: nextCollected.name || "",
            customerPhone,
            collectedData: nextCollected,
          });
          nextCollected.appointmentId = String(appointment._id);
          nextCollected.appointmentConfirmed = true;
          const when = formatSlotLabel(fallbackSlot, timeZone);
          return {
            ...bookingResult,
            answer:
              language === "hi"
                ? `बढ़िया, ${when} के लिए आपका college visit confirm हो गया है। धन्यवाद, goodbye।`
                : `Perfect, your college visit for ${when} is confirmed. Thank you, goodbye.`,
            endCall: true,
            endReason: "appointment_confirmed",
            stage: "completed",
            nextState: {
              ...nextState,
              stage: "completed",
              endCall: true,
              collectedData: nextCollected,
              bookingStatus: "completed",
            },
          };
        } catch {
          // fall through to soft recovery below
        }
      }

      if (retryMatch.slots.length && !confirming) {
        return {
          ...bookingResult,
          answer: buildAlternativesReply(retryMatch.slots, timeZone, language),
          endCall: false,
          endReason: "",
          stage: "appointment_booking",
          nextState: {
            ...nextState,
            stage: "appointment_booking",
            endCall: false,
            collectedData: {
              ...nextCollected,
              offeredSlots: retryMatch.slots.slice(0, 3),
              alternativesOffered: true,
            },
          },
        };
      }

      return {
        ...bookingResult,
        answer: "That slot was just taken. Could you share another time that works?",
        endCall: false,
        endReason: "",
        stage: "appointment_booking",
        nextState: {
          ...nextState,
          stage: "appointment_booking",
          endCall: false,
        },
      };
    }
  }

  return {
    ...bookingResult,
    answer,
    nextState,
  };
};
