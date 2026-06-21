import { ConversationStates } from "../constants/events.js";

const TRANSITIONS = {
  [ConversationStates.INIT]: [ConversationStates.GREETING],
  [ConversationStates.GREETING]: [ConversationStates.INTENT_CAPTURE],
  [ConversationStates.INTENT_CAPTURE]: [ConversationStates.LANGUAGE_DETECTION, ConversationStates.QUALIFICATION],
  [ConversationStates.LANGUAGE_DETECTION]: [ConversationStates.QUALIFICATION],
  [ConversationStates.QUALIFICATION]: [ConversationStates.INFORMATION_DELIVERY, ConversationStates.BOOKING, ConversationStates.TRANSFER, ConversationStates.CALLBACK],
  [ConversationStates.INFORMATION_DELIVERY]: [ConversationStates.BOOKING, ConversationStates.TRANSFER, ConversationStates.CONFIRMATION, ConversationStates.CLOSING],
  [ConversationStates.BOOKING]: [ConversationStates.CONFIRMATION, ConversationStates.CLOSING],
  [ConversationStates.TRANSFER]: [ConversationStates.TERMINATED],
  [ConversationStates.CALLBACK]: [ConversationStates.CONFIRMATION, ConversationStates.CLOSING],
  [ConversationStates.CONFIRMATION]: [ConversationStates.CLOSING],
  [ConversationStates.CLOSING]: [ConversationStates.TERMINATED],
  [ConversationStates.TERMINATED]: [],
};

export class ConversationStateEngine {
  constructor() {
    this.transitionMap = TRANSITIONS;
  }

  canTransition(current, next) {
    if (current === next) return true;
    return (this.transitionMap[current] || []).includes(next);
  }

  transition(state, nextState) {
    const current = state.currentState || ConversationStates.INIT;
    if (!this.canTransition(current, nextState)) {
      return {
        ...state,
        previousState: current,
        violation: `Invalid transition ${current} -> ${nextState}`,
      };
    }

    return {
      ...state,
      previousState: current,
      currentState: nextState,
      nextExpectedState: (this.transitionMap[nextState] || [])[0] || null,
      conversationStage: nextState,
      violation: "",
    };
  }
}

export const conversationStateEngine = new ConversationStateEngine();
