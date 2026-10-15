"use client";
import { useEffect, useState } from "react";
import { LatestRequest } from "@/lib/latest-request";

export function useLatestRequest() {
  const [requests] = useState(() => new LatestRequest());
  useEffect(() => () => requests.cancel(), [requests]);
  return requests;
}
