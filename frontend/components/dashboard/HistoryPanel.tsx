"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getTenantId } from "@/lib/auth";
import { CallsTable } from "@/components/dashboard/CallsTable";
import type { CallAnalysis } from "@/lib/types";

export function HistoryPanel() {
  const tenantId = getTenantId();
  const [items, setItems] = useState<CallAnalysis[]>([]);
  const [error, setError] = useState(tenantId ? "" : "No tenant session available.");

  useEffect(() => {
    if (!tenantId) {
      return;
    }
    api
      .listCallAnalysis(tenantId)
      .then((response) => setItems(response.data))
      .catch((err: Error) => setError(err.message));
  }, [tenantId]);

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-[#EF4444]">{error}</p> : null}
      <CallsTable rows={items} />
    </div>
  );
}
