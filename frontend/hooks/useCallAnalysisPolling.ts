"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { getAnalysisPollInterval, isAnalysisPending } from "@/lib/callDetail";
import type { CallAnalysis } from "@/lib/types";

export function useCallAnalysisPolling(
  sessionId: string | null,
  call: CallAnalysis | null,
  onUpdate: (call: CallAnalysis) => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled || !sessionId || !call || !isAnalysisPending(call)) {
      return;
    }

    const timer = setInterval(() => {
      api
        .getCallAnalysis(sessionId)
        .then((response) => onUpdate(response.data))
        .catch(() => {});
    }, getAnalysisPollInterval());

    return () => clearInterval(timer);
  }, [enabled, sessionId, call?.analysisStatus, onUpdate]);
}
