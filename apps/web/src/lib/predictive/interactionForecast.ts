/**
 * LIGHTWEIGHT INTERACTION FORECASTING
 * Predicts user intent based on trajectory, velocity, and recency.
 */
export enum Intent {
  SCROLL_DOWN = 'SCROLL_DOWN',
  SCROLL_UP = 'SCROLL_UP',
  HOVER_ROOM = 'HOVER_ROOM',
  IDLE = 'IDLE'
}

export interface Trajectory {
  direction: 'up' | 'down' | 'none';
  velocity: number; // pixels per ms
  confidence: number; // 0 to 1
}

class InteractionForecast {
  private lastScrollTop = 0;
  private lastScrollTime = Date.now();
  private trajectory: Trajectory = { direction: 'none', velocity: 0, confidence: 0 };

  public updateScroll(scrollTop: number) {
    const now = Date.now();
    const dt = now - this.lastScrollTime;
    if (dt === 0) return;

    const dy = scrollTop - this.lastScrollTop;
    const velocity = Math.abs(dy) / dt;
    const direction = dy > 0 ? 'down' : (dy < 0 ? 'up' : 'none');

    // Smooth trajectory
    this.trajectory = {
      direction: direction as any,
      velocity: (this.trajectory.velocity * 0.6) + (velocity * 0.4),
      confidence: Math.min(1, velocity / 2) // Higher velocity = higher confidence in direction
    };

    this.lastScrollTop = scrollTop;
    this.lastScrollTime = now;
  }

  public getTrajectory(): Trajectory {
    return { ...this.trajectory };
  }

  /**
   * Predicts if a specific offset will be visible within the next 500ms.
   */
  public willBeVisible(targetTop: number, viewportTop: number, viewportHeight: number): boolean {
    const { direction, velocity, confidence } = this.trajectory;
    if (confidence < 0.3) return false;

    const lookaheadMs = 500;
    const lookaheadDistance = velocity * lookaheadMs;

    if (direction === 'down') {
      const futureViewportBottom = viewportTop + viewportHeight + lookaheadDistance;
      return targetTop < futureViewportBottom && targetTop > viewportTop;
    } else if (direction === 'up') {
      const futureViewportTop = viewportTop - lookaheadDistance;
      return targetTop > futureViewportTop && targetTop < viewportTop + viewportHeight;
    }

    return false;
  }
}

export const interactionForecast = new InteractionForecast();
