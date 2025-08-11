import { useEffect, useMemo, useState } from "react";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Activity, Gauge, Database, RefreshCw } from "lucide-react";
import { useWebVitals } from "@/hooks/useWebVitals";
import { supabase } from "@/integrations/supabase/client";

const ratingColor: Record<string, string> = {
  good: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  needsImprovement: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  poor: "bg-red-500/20 text-red-200 border-red-500/30",
};

function VitalItem({
  label,
  value,
  unit,
  rating,
}: {
  label: string;
  value?: number;
  unit?: string;
  rating?: string;
}) {
  const percent = useMemo(() => {
    if (value == null) return 0;
    // Simple normalization for progress bar visuals
    const max = label === "CLS" ? 1 : 5000; // 5s cap, CLS cap 1
    const v = Math.min(value, max);
    return Math.round((v / max) * 100);
  }, [value, label]);

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {rating && (
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${ratingColor[rating] || "bg-white/10 text-white/80 border-white/20"}`}>
            {rating.replace("needs-improvement", "needsImprovement")}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value != null ? value.toFixed(label === "CLS" ? 3 : 0) : "—"}</span>
          <span className="text-sm text-gray-400">{value != null ? unit : ""}</span>
        </div>
        <Progress value={percent} className="mt-3" />
      </CardContent>
    </Card>
  );
}

const Performance = () => {
  const vitals = useWebVitals();
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    document.title = "Performance | CineSphere";
  }, []);

  const testSupabaseLatency = async () => {
    try {
      setTesting(true);
      const start = performance.now();
      // Lightweight ping: query a small public table with limit 1
      await supabase.from("announcements").select("id").limit(1);
      const end = performance.now();
      setLatencyMs(Math.max(0, Math.round(end - start)));
    } catch (e) {
      setLatencyMs(null);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    testSupabaseLatency();
  }, []);

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <main className="pt-24 pb-16 px-4 md:px-8">
        <header className="max-w-6xl mx-auto mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Activity className="text-cinesphere-purple" />
            Performance Insights
          </h1>
          <p className="text-gray-300 mt-2">Live Web Vitals, route load metrics, and Supabase latency.</p>
        </header>

        <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <VitalItem label="LCP" value={vitals.LCP?.value} unit="ms" rating={vitals.LCP?.rating} />
          <VitalItem label="FID" value={vitals.FID?.value} unit="ms" rating={vitals.FID?.rating} />
          <VitalItem label="INP" value={vitals.INP?.value} unit="ms" rating={vitals.INP?.rating} />
          <VitalItem label="CLS" value={vitals.CLS?.value} unit="" rating={vitals.CLS?.rating} />
          <VitalItem label="TTFB" value={vitals.TTFB?.value} unit="ms" rating={vitals.TTFB?.rating} />

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Database className="h-4 w-4 text-cinesphere-purple" /> Supabase Latency</CardTitle>
              <Badge variant="secondary" className="bg-white/10 border-white/20">ms</Badge>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{latencyMs != null ? latencyMs : "—"}</span>
                <Button size="sm" variant="outline" className="border-white/20" onClick={testSupabaseLatency} disabled={testing}>
                  <RefreshCw className="h-4 w-4 mr-2" /> {testing ? "Testing..." : "Retest"}
                </Button>
              </div>
              <p className="text-sm text-gray-400 mt-2">Measures a lightweight SELECT against announcements.</p>
            </CardContent>
          </Card>
        </section>

        <section className="max-w-6xl mx-auto mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-cinesphere-purple" /> Tips to improve</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2 text-gray-300">
                <li>Optimize images and enable lazy-loading where possible.</li>
                <li>Reduce third-party scripts and defer non-critical code.</li>
                <li>Use React.memo and code-splitting for heavy components.</li>
                <li>Leverage CDN caching and compress assets (gzip/brotli).</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>About Web Vitals</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300">
              <p className="mb-2">Core Web Vitals reflect real user experience:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>LCP: Loading performance (target ≤ 2500ms)</li>
                <li>FID/INP: Interactivity (target ≤ 200ms)</li>
                <li>CLS: Visual stability (target ≤ 0.1)</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Performance;
