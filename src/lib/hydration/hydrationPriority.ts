export enum HydrationPriority {
  CRITICAL = 100, // Visible messages, active typing
  HIGH = 80,      // Visible feed items, visible comments
  MEDIUM = 50,    // Partially visible content, nearby pages
  LOW = 20,       // Hidden rooms, inactive tabs
  BACKGROUND = 0  // Analytics, background syncing
}

export interface HydrationTarget {
  entityId: string;
  entityType: string;
  priority: HydrationPriority;
  lastUpdated: number;
  isVisible: boolean;
}

class HydrationPriorityGovernance {
  private targets: Map<string, HydrationTarget> = new Map();

  public setTarget(entityId: string, entityType: string, isVisible: boolean) {
    const priority = this.calculatePriority(entityType, isVisible);
    this.targets.set(entityId, {
      entityId,
      entityType,
      priority,
      isVisible,
      lastUpdated: Date.now()
    });
  }

  public getTarget(entityId: string): HydrationTarget | undefined {
    return this.targets.get(entityId);
  }

  public removeTarget(entityId: string) {
    this.targets.delete(entityId);
  }

  public getPriority(entityId: string): HydrationPriority {
    return this.targets.get(entityId)?.priority || HydrationPriority.LOW;
  }

  private calculatePriority(entityType: string, isVisible: boolean): HydrationPriority {
    if (!isVisible) return HydrationPriority.LOW;
    
    switch (entityType) {
      case 'message':
      case 'typing_indicator':
        return HydrationPriority.CRITICAL;
      case 'post':
      case 'comment':
        return HydrationPriority.HIGH;
      default:
        return HydrationPriority.MEDIUM;
    }
  }

  public getAllTargets(): HydrationTarget[] {
    return Array.from(this.targets.values());
  }
}

export const hydrationPriority = new HydrationPriorityGovernance();
