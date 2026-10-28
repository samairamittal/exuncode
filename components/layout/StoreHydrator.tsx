"use client";

import { useEffect } from "react";
import { useInvestigator } from "@/lib/store";

/** Loads saved investigator data into the store once, on the client. */
export function StoreHydrator() {
  const hydrate = useInvestigator((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return null;
}
