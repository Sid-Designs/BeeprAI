const cleanText = (value = "", max = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const isBookingStage = (stage = "") => {
  const value = cleanText(stage, 60).toLowerCase();
  return ["appointment_booking", "confirmation", "callback", "booking_readiness"].includes(value);
};

export const buildSilencePresencePrompt = ({
  language = "en",
  stage = "",
  closeOffered = false,
  inBooking = false,
  hasUserSpoken = true,
} = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  const booking = inBooking || isBookingStage(stage);

  if (!hasUserSpoken) {
    if (lang === "mr") {
      return "Hello, तुम्ही ऐकत आहात का? मी admission मध्ये मदत करू शकतो.";
    }
    if (lang === "hi") {
      return "Hello, क्या आप सुन पा रहे हैं? मैं admission में मदत कर सकता हूँ।";
    }
    return "Hello, are you still there? I can help with admission if you are available.";
  }

  if (closeOffered) {
    if (lang === "mr") {
      return "तुम्ही अजून आहात का? नसेल तर मी कॉल बंद करतो.";
    }
    if (lang === "hi") {
      return "क्या आप अभी भी हैं? अगर नहीं, तो मैं कॉल बंद कर दूँगा।";
    }
    return "Are you still there? If not, I will close the call now.";
  }

  if (booking) {
    if (lang === "mr") {
      return "तुम्ही अजून आहात का? मी appointment पूर्ण करण्यात मदत करू शकतो.";
    }
    if (lang === "hi") {
      return "क्या आप अभी भी हैं? मैं appointment पूरी करने में मदद कर सकता हूँ।";
    }
    return "Are you still there? I can help finish your appointment booking.";
  }

  if (lang === "mr") {
    return "तुम्ही अजून आहात का? आणखी काही मदत हवी आहे का?";
  }
  if (lang === "hi") {
    return "क्या आप अभी भी हैं? क्या मैं और कुछ मदद कर सकता हूँ?";
  }
  return "Are you still there? Is there anything else I can help you with?";
};

export const buildSilenceGoodbye = ({ language = "en" } = {}) => {
  const lang = cleanText(language, 10).toLowerCase();
  if (lang === "mr") {
    return "मी कॉल बंद करतो. वेळ दिल्याबद्दल धन्यवाद. Goodbye.";
  }
  if (lang === "hi") {
    return "मैं कॉल बंद कर रहा हूँ। समय देने के लिए धन्यवाद। Goodbye.";
  }
  return "I will close the call now. Thank you for your time. Goodbye.";
};
