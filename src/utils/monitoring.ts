import { supabase } from '@/integrations/supabase/client';

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(key: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(key, duration);
    };
  }

  recordMetric(key: string, value: number): void {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(value);
  }

  getMetrics(key: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(key);
    if (!values || values.length === 0) return null;

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  clearMetrics(key?: string): void {
    if (key) {
      this.metrics.delete(key);
    } else {
      this.metrics.clear();
    }
  }

  async logToAnalytics(eventType: string, data?: Record<string, any>): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_analytics').insert({
        user_id: user.id,
        event_type: eventType,
        event_data: data || {},
        page_url: window.location.pathname
      });
    } catch (error) {
      console.error('Failed to log analytics:', error);
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// Health check utility
export async function checkSystemHealth(): Promise<any> {
  try {
    const response = await supabase.functions.invoke('health-check');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Rate limit check utility
export async function checkRateLimit(actionType: string, maxRequests = 60, windowMinutes = 60): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const response = await supabase.functions.invoke('rate-limit-check', {
      body: { action_type: actionType, max_requests: maxRequests, window_minutes: windowMinutes }
    });

    return response.data?.allowed || false;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return false;
  }
}
