export class ToolCallingEngine {
  async maybeInvoke({ userText, tools = {} }) {
    if (/\b(schedule|book|appointment)\b/i.test(userText) && tools.scheduleCallback) {
      return tools.scheduleCallback();
    }
    return null;
  }
}

export const toolCallingEngine = new ToolCallingEngine();
