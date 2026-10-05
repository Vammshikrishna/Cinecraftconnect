// Universal Notification Chime for Web App
export const playNotificationChime = () => {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const now = ctx.currentTime;
    
    // Tone: 659.25Hz (E5) rising to 880Hz (A5) for a crisp, professional notification
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
    
    setTimeout(() => {
      try { ctx.close(); } catch {}
    }, 400);
  } catch (err) {
    // Suppress browser autoplay restrictions
  }
};
