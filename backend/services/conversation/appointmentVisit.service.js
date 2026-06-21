const cleanText = (value = "", max = 160) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const VISIT_PRESETS = Object.freeze({
  campus_visit: {
    shortLabel: "campus visit",
    bookingNoun: "college visit",
    scheduleEn: "I can help schedule a campus visit at the college.",
    scheduleHi: "मैं college में campus visit schedule करने में मदद कर सकता हूँ।",
    scheduleMr: "मी college मध्ये campus visit schedule करण्यात मदत करू शकतो.",
  },
  counselor_call: {
    shortLabel: "counselor call",
    bookingNoun: "counselor call",
    scheduleEn: "I can arrange a counselor call if you'd like more detail.",
    scheduleHi: "अगर चाहें तो मैं counselor call arrange कर सकता हूँ।",
    scheduleMr: "हवे असल्यास मी समुपदेशक कॉल ठेवू शकतो.",
  },
  store_visit: {
    shortLabel: "store visit",
    bookingNoun: "store visit",
    scheduleEn: "I can help you book a visit to our store.",
    scheduleHi: "मैं store visit book करने में मदद कर सकता हूँ।",
    scheduleMr: "मी store visit book करण्यात मदत करू शकतो.",
  },
});

/**
 * Resolve how appointments should be described for a tenant/agent.
 * Defaults to campus/college visit — not a phone counselor call.
 */
export const resolveAppointmentVisitConfig = (policy = {}) => {
  const type = cleanText(policy.appointmentVisitType, 40).toLowerCase() || "campus_visit";
  const customLabel = cleanText(policy.appointmentVisitLabel, 120);
  const preset = VISIT_PRESETS[type] || VISIT_PRESETS.campus_visit;

  if (customLabel) {
    return {
      type,
      shortLabel: customLabel,
      bookingNoun: customLabel,
      scheduleEn: `I can help schedule a ${customLabel}.`,
      scheduleHi: `मैं ${customLabel} schedule करने में मदद कर सकता हूँ।`,
      scheduleMr: `मी ${customLabel} schedule करण्यात मदत करू शकतो.`,
    };
  }

  return { type, ...preset };
};

export const buildVisitScheduleLine = ({ language = "en", policy = {} } = {}) => {
  const visit = resolveAppointmentVisitConfig(policy);
  const lang = cleanText(language, 10).toLowerCase();
  if (lang === "hi") return visit.scheduleHi;
  if (lang === "mr") return visit.scheduleMr;
  return visit.scheduleEn;
};
