import { useEffect, useState } from "react";
import { onCLS, onFID, onLCP, onINP, onTTFB, Metric } from "web-vitals";

export type WebVitalName = Metric["name"];

export interface WebVitalsState {
  CLS?: Metric;
  FID?: Metric;
  LCP?: Metric;
  INP?: Metric;
  TTFB?: Metric;
}

export function useWebVitals() {
  const [vitals, setVitals] = useState<WebVitalsState>({});

  useEffect(() => {
    const update = (metric: Metric) => {
      setVitals((prev) => ({ ...prev, [metric.name]: metric }));
    };

    const unsubscribers = [
      onCLS(update),
      onFID(update),
      onLCP(update),
      onINP(update),
      onTTFB(update),
    ];

    return () => {
      // web-vitals returns void; no explicit unsubscribe needed in v4
    };
  }, []);

  return vitals;
}
