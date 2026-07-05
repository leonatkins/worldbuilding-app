"use client";

/**
 * Stamps view history when a subject page is opened (step 15a). Renders nothing;
 * fires `recordSubjectView` once per mounted subject from an effect (not during
 * render — an RSC write anti-pattern). Re-running on `subjectId` change is
 * intended (client-side nav between subjects each counts as a view); the upsert
 * is idempotent, so React strict-mode's dev double-invoke is harmless.
 */
import { useEffect } from "react";
import { recordSubjectView } from "@/app/actions/subject-views";

export function RecordView({ subjectId }: { subjectId: string }) {
  useEffect(() => {
    void recordSubjectView(subjectId);
  }, [subjectId]);
  return null;
}
