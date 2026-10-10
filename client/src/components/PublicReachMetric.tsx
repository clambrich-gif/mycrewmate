import { trpc } from "@/lib/trpc";
import type { PublicReachMetricKey } from "@shared/public-reach-metrics";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
} from "react";

/**
 * Die öffentliche Reichweite wird ausschließlich auf den echten MyCrewMate-
 * Domains gezählt. Lokale Entwicklung, Vorschauen und Tests beeinflussen die
 * Zahlen im Master-Portal deshalb nicht.
 */
function isCountablePublicHost() {
  if (typeof window === "undefined") return false;
  return ["mycrewmate.de", "www.mycrewmate.de", "app.mycrewmate.de"].includes(
    window.location.hostname.toLowerCase()
  );
}

/**
 * Meldet genau einen anonymen Seiten- oder Aktionsaufruf. Es werden weder
 * Cookies noch IP-Adressen, Gerätekennungen oder Besucherprofile verwendet.
 */
export function usePublicReachMetric(metric: PublicReachMetricKey) {
  const recorded = useRef(false);
  const record = trpc.publicReach.record.useMutation();

  return useCallback(() => {
    if (recorded.current || !isCountablePublicHost()) return;
    recorded.current = true;
    record.mutate({ metric });
  }, [metric, record]);
}

/** Zeichnet einen Seitenaufruf beim einmaligen Einhängen der Seite auf. */
export function PublicReachPageView({ metric }: { metric: PublicReachMetricKey }) {
  const recordOnce = usePublicReachMetric(metric);

  useEffect(() => {
    recordOnce();
  }, [recordOnce]);

  return null;
}

/**
 * Zeichnet die Formularansicht erst auf, wenn der entsprechende Bereich
 * tatsächlich in den sichtbaren Browserausschnitt gelangt.
 */
export function PublicReachMetricOnVisible({
  metric,
  children,
}: PropsWithChildren<{ metric: PublicReachMetricKey }>) {
  const elementRef = useRef<HTMLDivElement>(null);
  const recordOnce = usePublicReachMetric(metric);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !isCountablePublicHost()) return;

    if (!("IntersectionObserver" in window)) {
      recordOnce();
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        recordOnce();
        observer.disconnect();
      },
      { threshold: 0.2 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [recordOnce]);

  return <div ref={elementRef}>{children}</div>;
}
