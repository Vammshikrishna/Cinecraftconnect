/**
 * CineCraft Connect - Web Audio Tone Synthesizer
 * Provides instant, zero-latency cellular ringback, busy, and disconnect tones.
 */

class CallAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private ringbackInterval: any = null;
  private activeOscillators: OscillatorNode[] = [];

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.ctx || this.ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Plays realistic cellular outgoing ringback tone (440Hz + 480Hz)
   * Standard cadence: 2 seconds tone, 3.5 seconds silence loop
   */
  public startOutgoingRingback(): void {
    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playToneBurst = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      try {
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        // Smooth fade-in and fade-out to prevent audio clicking
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
        gain.gain.setValueAtTime(0.12, now + 1.9);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.05);
        osc2.stop(now + 2.05);

        this.activeOscillators.push(osc1, osc2);
      } catch (e) {
        console.warn('[CallAudio] Ringback burst error:', e);
      }
    };

    // First burst immediately
    playToneBurst();
    // Subsequent bursts every 5.5 seconds
    this.ringbackInterval = setInterval(playToneBurst, 5500);
  }

  /**
   * Plays realistic "User Busy / Call Declined" fast busy signal (480Hz + 620Hz)
   * 3 rapid beeps
   */
  public playBusySignal(): void {
    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const startTime = now + (i * 0.45);
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.setValueAtTime(480, startTime);
        osc2.frequency.setValueAtTime(620, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.03);
        gain.gain.setValueAtTime(0.15, startTime + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + 0.26);
        osc2.stop(startTime + 0.26);
      }
    } catch (e) {
      console.warn('[CallAudio] Busy signal error:', e);
    }
  }

  /**
   * Plays soft modern call disconnect chime
   */
  public playDisconnectChime(): void {
    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.25);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('[CallAudio] Disconnect chime error:', e);
    }
  }

  /**
   * Plays pleasant harmonic join chime when a participant connects (C5 -> G5)
   */
  public playJoinChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Tone 1: C5 (523.25 Hz)
      osc1.frequency.setValueAtTime(523.25, now);
      // Tone 2: G5 (783.99 Hz)
      osc2.frequency.setValueAtTime(783.99, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.04);
      gain.gain.setValueAtTime(0.09, now + 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn('[CallAudio] Join chime error:', e);
    }
  }

  /**
   * Stop all active tones and intervals
   */
  public stop(): void {
    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval);
      this.ringbackInterval = null;
    }
    this.activeOscillators.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];
  }
}

export const callAudio = new CallAudioSynthesizer();
