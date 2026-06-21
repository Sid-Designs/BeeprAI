const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasAny = (text, items = []) => items.some((item) => text.includes(item));

export const detectObjectionType = (query = "") => {
  const text = normalizeText(query);
  if (!text) return "";
  if (hasAny(text, ["not interested", "no thanks", "do not call"])) return "not_interested";
  if (hasAny(text, ["call later", "later", "busy now"])) return "call_later";
  if (hasAny(text, ["expensive", "too costly", "high fees", "price high"])) return "price";
  if (hasAny(text, ["send details", "whatsapp", "message me"])) return "send_details";
  return "";
};

export const getNextBestAction = ({
  query = "",
  state = {},
  conversationState = {},
  userIntent = null,
} = {}) => {
  const objection = detectObjectionType(query);
  if (objection) return { action: "handle_objection", objection };

  const intent = userIntent?.intent || state?.userIntent?.intent || "";
  if (intent === "fee_inquiry") return { action: "answer_fees", objection: "" };
  if (intent === "admission_inquiry") return { action: "guide_admission", objection: "" };
  if (intent === "information_request") return { action: "answer_question", objection: "" };
  if (intent === "callback_request") return { action: "schedule_callback", objection: "" };
  if (intent === "appointment_booking") return { action: "book_appointment", objection: "" };
  if (intent === "support_request") return { action: "resolve_support", objection: "" };

  if (conversationState?.userEmotion === "confused") return { action: "clarify", objection: "" };
  if (conversationState?.userEmotion === "frustrated") return { action: "reassure", objection: "" };
  if (!state?.greeted) return { action: "open", objection: "" };
  if (state?.leadStatus === "qualified") return { action: "close_or_confirm", objection: "" };
  return { action: "qualify", objection: "" };
};

export const getObjectionGuidance = (objection = "", language = "en") => {
  const isHi = language === "hi";
  const isMr = language === "mr";

  if (objection === "call_later") {
    if (isMr) return "त्यांना short acknowledge करून convenient वेळ विचार.";
    if (isHi) return "संक्षेप में acknowledge करके convenient समय पूछो.";
    return "Acknowledge briefly and ask for a convenient follow-up time.";
  }
  if (objection === "price") {
    if (isMr) return "Value + options समजावून next practical step विचारा.";
    if (isHi) return "Value और options समझाकर practical next step पूछो.";
    return "Address value clearly, then ask one practical next-step question.";
  }
  if (objection === "send_details") {
    if (isMr) return "Details देण्याचा मार्ग confirm करा आणि एक qualifying question विचारा.";
    if (isHi) return "Details भेजने का तरीका confirm करो और एक qualifying question पूछो.";
    return "Confirm how to share details and ask one qualifying question.";
  }
  if (objection === "not_interested") {
    if (isMr) return "Graceful close करा; दबाव आणू नका.";
    if (isHi) return "Graceful close करो; push मत करो.";
    return "Close gracefully without pressure.";
  }
  return "";
};

export const buildObjectionPlaybookReply = ({
  objection = "",
  language = "en",
  variantSeed = 0,
} = {}) => {
  const key = `${objection}:${language}`;
  const playbooks = {
    "price:en": [
      "I understand cost matters. I can share the value and options quickly. Which part matters most, budget or outcomes?",
      "Fair point on pricing. I can walk you through suitable options in a minute. Would you like the most affordable path first?",
      "Totally valid concern. Let me keep this practical and clear. Should I start with fees or expected benefits?",
    ],
    "call_later:en": [
      "Sure, no problem. What time today works best for a quick callback?",
      "Understood. I can call later at your convenience. What exact time should I try?",
      "Absolutely, I can keep this flexible. Which time slot suits you best?",
    ],
    "send_details:en": [
      "Happy to share details. Before that, what is your main priority so I send the most relevant information?",
      "I can send that. To keep it useful, are you comparing pricing, eligibility, or timelines?",
      "Sure, I can share details. Which part should I focus on first: fees, process, or timeline?",
    ],
    "not_interested:en": [
      "Understood, thanks for your time. I will close the call now.",
      "No worries at all. Thank you for taking the call, I will end it here.",
      "Got it, and I appreciate your time. I will close the call now.",
    ],
  };

  const fallback = "I understand. Could you share one detail so I can help quickly?";
  const options = playbooks[key] || playbooks[`${objection}:en`] || [fallback];
  const idx = Math.abs(Number(variantSeed || 0)) % options.length;
  return options[idx];
};
