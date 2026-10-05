import { MediaPriority } from './mediaPriority';
import { mediaTelemetry } from './mediaTelemetry';
import { networkGovernor } from '../network/networkGovernor';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { RuntimeResource } from '../runtime/runtimeFairness';
import { predictiveGovernor } from '../predictive/predictiveGovernor';
import { interactionForecast } from '../predictive/interactionForecast';

interface ManagedMedia {
  id: string;
  type: 'image' | 'video';
  priority: MediaPriority;
  sizeBytes: number;
  lastUsed: number;
  isHydrated: boolean;
  metadata?: { offsetTop: number };
  element?: HTMLImageElement | HTMLVideoElement;
}

/**
 * THE CENTRAL GPU & MEDIA ORCHESTRATION GOVERNOR
 * Manages GPU memory budget, decode throttling, and viewport-aware eviction.
 */
class MediaGovernor {
  private mediaRegistry: Map<string, ManagedMedia> = new Map();
  private maxGpuMemoryMb = 256; // 256MB GPU budget for mobile
  private currentGpuMemoryMb = 0;
  private activeDecodes = 0;
  private maxConcurrentDecodes = 3; // Bounded for mobile battery/thermal

  /**
   * Registers media for governance.
   */
  public register(id: string, type: 'image' | 'video', sizeBytes: number) {
    if (this.mediaRegistry.has(id)) return;

    this.mediaRegistry.set(id, {
      id,
      type,
      priority: MediaPriority.IDLE,
      sizeBytes,
      lastUsed: Date.now(),
      isHydrated: false
    });
  }

  /**
   * Updates media priority based on viewport visibility.
   */
  public updatePriority(id: string, priority: MediaPriority) {
    const media = this.mediaRegistry.get(id);
    if (!media) return;

    media.priority = priority;
    media.lastUsed = Date.now();

    if (priority <= MediaPriority.HIGH) {
      this.hydrateMedia(media);
    } else if (priority >= MediaPriority.LOW) {
      this.evictMedia(media);
    }
  }

  private async hydrateMedia(media: ManagedMedia) {
    if (media.isHydrated) return;

    // Check GPU memory budget
    const sizeMb = media.sizeBytes / (1024 * 1024);
    
    // Network Governance
    const networkMultiplier = networkGovernor.getNetworkMultiplier();
    
    // Global Runtime Governance: Adaptive Device Intelligence
    const runtimeMultiplier = runtimeGovernor.getAdaptiveMultiplier(RuntimeResource.GPU);
    
    const combinedMultiplier = networkMultiplier * runtimeMultiplier;
    const adjustedBudget = this.maxGpuMemoryMb * combinedMultiplier;
    const adjustedConcurrentDecodes = Math.max(1, Math.floor(this.maxConcurrentDecodes * combinedMultiplier));

    if (this.currentGpuMemoryMb + sizeMb > adjustedBudget) {
      this.performEviction(adjustedBudget);
    }

    // Decode throttling
    if (this.activeDecodes >= adjustedConcurrentDecodes) {
      mediaTelemetry.reportCongestion();
      // Defer hydration to next frame/idle
      setTimeout(() => this.hydrateMedia(media), 100);
      return;
    }

    this.activeDecodes++;
    const startTime = performance.now();

    try {
      // In a real app, we would use createImageBitmap or similar for off-thread decode
      // For this architecture, we mark it as hydrated
      media.isHydrated = true;
      this.currentGpuMemoryMb += sizeMb;
      mediaTelemetry.trackMediaLoad(media.type, media.sizeBytes);
      mediaTelemetry.trackDecode(performance.now() - startTime);
    } finally {
      this.activeDecodes--;
    }
  }

  private evictMedia(media: ManagedMedia) {
    if (!media.isHydrated) return;

    media.isHydrated = false;
    const sizeMb = media.sizeBytes / (1024 * 1024);
    this.currentGpuMemoryMb -= sizeMb;
    mediaTelemetry.trackMediaUnload(media.type, media.sizeBytes);
    mediaTelemetry.trackEviction();

    // In a real app, we would nullify the src and release GPU textures
    if (media.element) {
      media.element.src = '';
      if (media.element instanceof HTMLVideoElement) {
        media.element.load();
      }
    }
  }

  private performEviction(budgetMb: number = this.maxGpuMemoryMb) {
    // Sort by priority and LRU (Least Recently Used)
    const candidates = Array.from(this.mediaRegistry.values())
      .filter(m => m.isHydrated && m.priority >= MediaPriority.MEDIUM)
      .sort((a, b) => b.priority - a.priority || a.lastUsed - b.lastUsed);

    for (const candidate of candidates) {
      this.evictMedia(candidate);
      if (this.currentGpuMemoryMb <= budgetMb * 0.7) break; // Evict until 70% budget
    }
  }

  public getStatus() {
    return {
      activeMedia: Array.from(this.mediaRegistry.values()).filter(m => m.isHydrated).length,
      memoryUsageMb: this.currentGpuMemoryMb,
      activeDecodes: this.activeDecodes
    };
  }

  /**
   * Predictive Media Governance: Pre-activates likely visible media.
   */
  public handleViewportMove(scrollTop: number, viewportHeight: number) {
    const candidates = Array.from(this.mediaRegistry.values())
      .filter(m => !m.isHydrated && m.priority >= MediaPriority.MEDIUM);

    for (const media of candidates) {
      const elementTop = media.metadata?.offsetTop || 0;
      if (interactionForecast.willBeVisible(elementTop, scrollTop, viewportHeight)) {
        // Predictive preparation if confidence and resources allow
        if (predictiveGovernor.shouldPredict(RuntimeResource.GPU)) {
          predictiveGovernor.executeAnticipatory(`media_${media.id}`, async () => {
            this.hydrateMedia(media);
          });
        }
      }
    }
  }
}

export const mediaGovernor = new MediaGovernor();
