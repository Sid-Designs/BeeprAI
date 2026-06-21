export class ConversationCompressionEngine {
  compress(transcript = []) {
    const tail = transcript.slice(-8);
    return tail.map((t) => `${t.role}: ${t.text}`).join(" | ").slice(0, 1200);
  }
}

export const conversationCompressionEngine = new ConversationCompressionEngine();
