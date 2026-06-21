export class HallucinationGuard {
  validate({ response, knownContext = "" }) {
    const text = String(response || "");
    const context = String(knownContext || "").toLowerCase();

    const unsafeClaims = ["as discussed earlier", "as i already checked", "your payment is confirmed"];
    for (const claim of unsafeClaims) {
      if (text.toLowerCase().includes(claim) && !context.includes(claim)) {
        return { ok: false, reason: "unseen_reference" };
      }
    }

    return { ok: true, reason: "clean" };
  }
}

export const hallucinationGuard = new HallucinationGuard();
