"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getLiveCallPollInterval, isLiveCallPollingEnabled } from "@/lib/liveCall";
import type { LeadOutcomeLive } from "@/lib/types";

type UseLiveCallPollingOptions = {
  enabled?: boolean;
  intervalMs?: number;
  onEnded?: (status: LeadOutcomeLive) => void;
};

export function useLiveCallPolling(
  sessionId: string | null,
  { enabled = true, intervalMs = getLiveCallPollInterval(), onEnded }: UseLiveCallPollingOptions = {},
) {
  const [status, setStatus] = useState<LeadOutcomeLive | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const endedRef = useRef(false);
  const onEndedRef = useRef(onEnded);

  onEndedRef.current = onEnded;

  useEffect(() => {
    endedRef.current = false;
    setStatus(null);
    setError("");

    if (!sessionId || !enabled || !isLiveCallPollingEnabled()) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      if (cancelled || endedRef.current) return;
      timer = setTimeout(() => {
        void poll();
      }, intervalMs);
    };

    const poll = async () => {
      if (cancelled || endedRef.current) return;

      setLoading(true);
      try {
        const response = await api.getLiveCallStatus(sessionId);
        if (cancelled) return;

        setStatus(response.data);
        setError("");

        if (response.data.isClosed) {
          endedRef.current = true;
          onEndedRef.current?.(response.data);
          return;
        }

        scheduleNext();
      } catch (err) {
        if (cancelled) return;
        const message = (err as Error).message || "Failed to load live call status";
        const isPendingStatus = /not found/i.test(message);
        if (!isPendingStatus) {
          setError(message);
        }
        scheduleNext();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, enabled, intervalMs]);

  const isLive = Boolean(sessionId && status && !status.isClosed);

  return {
    status,
    error,
    loading,
    isLive,
    isWaiting: Boolean(sessionId && !status && !error),
  };
}
