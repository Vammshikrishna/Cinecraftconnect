import { videoTelemetry } from './videoTelemetry';
import { VideoQualityProfile, VideoQualityManager } from './videoQuality';
import { runtimeGovernor } from '../runtime/runtimeGovernor';
import { deviceIntelligence } from '../runtime/deviceIntelligence';
import { RuntimeResource } from '../runtime/runtimeFairness';

interface ManagedVideo {
  id: string;
  url: string;
  quality: VideoQualityProfile;
  isActive: boolean;
  element?: HTMLVideoElement;
}

/**
 * THE CENTRAL VIDEO PLAYBACK INTELLIGENCE ENGINE
 */
class VideoGovernor {
  private videoRegistry: Map<string, ManagedVideo> = new Map();

  /**
   * Registers a video for adaptive governance.
   */
  public register(id: string, url: string) {
    if (this.videoRegistry.has(id)) return;

    this.videoRegistry.set(id, {
      id,
      url,
      quality: VideoQualityProfile.MEDIUM,
      isActive: false
    });
  }

  /**
   * Updates playback quality based on current environment.
   */
  public async evaluateAdaptiveQuality(id: string) {
    const video = this.videoRegistry.get(id);
    if (!video) return;

    const networkMetrics = (navigator as any).connection || {};
    const speedBps = (networkMetrics.downlink || 1) * 1000000;
    const deviceMetrics = deviceIntelligence.getMetrics();

    const optimalQuality = VideoQualityManager.getOptimalProfile(
      speedBps,
      deviceMetrics.isLowPowerMode,
      deviceMetrics.thermalState
    );

    if (video.quality !== optimalQuality) {
      video.quality = optimalQuality;
      videoTelemetry.trackQualitySwitch(optimalQuality);
      this.applyQuality(video);
    }
  }

  private applyQuality(video: ManagedVideo) {
    if (!video.element) return;
    
    // In a real HLS/DASH scenario, we would trigger a quality switch in the player.
    // For this architecture, we track that the governor has commanded the switch.
    console.log(`[VIDEO] Switching ${video.id} to ${video.quality}`);
  }

  /**
   * Predictive Buffer Governance:
   * Determines if we should pre-buffer a video before it's visible.
   */
  public shouldPrebuffer(): boolean {
    const multiplier = runtimeGovernor.getAdaptiveMultiplier(RuntimeResource.NETWORK);
    // Suppress pre-buffering if device is under pressure or network is congested
    return multiplier > 0.7;
  }

  public activatePlayback(id: string, element: HTMLVideoElement) {
    const video = this.videoRegistry.get(id);
    if (!video) return;

    video.isActive = true;
    video.element = element;
    this.evaluateAdaptiveQuality(id);
  }

  public deactivatePlayback(id: string) {
    const video = this.videoRegistry.get(id);
    if (!video) return;

    video.isActive = false;
    if (video.element) {
      video.element.pause();
      // Drop quality to save bandwidth while offscreen
      video.quality = VideoQualityProfile.ULTRA_LOW;
    }
  }
}

export const videoGovernor = new VideoGovernor();
