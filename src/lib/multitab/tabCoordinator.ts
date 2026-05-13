import { tabTelemetry } from './tabTelemetry';

export enum TabRole {
  LEADER = 'LEADER',
  FOLLOWER = 'FOLLOWER'
}

interface TabHeartbeat {
  id: string;
  role: TabRole;
  timestamp: number;
  generation: number;
}

export type CoordinationEvent = 
  | { type: 'AUTH_UPDATE'; payload: any }
  | { type: 'REALTIME_UPDATE'; payload: any }
  | { type: 'WORKER_RESULT'; payload: any }
  | { type: 'STATE_SYNC'; payload: any };

/**
 * THE CENTRAL CROSS-TAB GOVERNANCE SYSTEM
 * Manages tab discovery, leader election, and ownership arbitration.
 */
class TabCoordinator {
  private tabId = Math.random().toString(36).substr(2, 9);
  private currentRole: TabRole = TabRole.FOLLOWER;
  private channel = new BroadcastChannel('cinecraft_coordination');
  private activeTabs: Map<string, TabHeartbeat> = new Map();
  private currentGeneration = Date.now();
  private listeners: Set<(event: CoordinationEvent) => void> = new Set();

  constructor() {
    this.setupListeners();
    this.startHeartbeat();
    this.electLeader();
  }

  private setupListeners() {
    this.channel.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'HEARTBEAT':
          this.handleHeartbeat(payload);
          break;
        case 'ELECTION_TRIGGER':
          this.electLeader();
          break;
        case 'LEADER_ANNOUNCEMENT':
          this.handleLeaderAnnouncement(payload);
          break;
        case 'COORDINATION_EVENT':
          this.handleCoordinationEvent(payload);
          break;
      }
    };

    window.addEventListener('beforeunload', () => {
      this.channel.postMessage({ type: 'TAB_CLOSING', payload: { id: this.tabId } });
    });
  }

  private startHeartbeat() {
    window.setInterval(() => {
      const heartbeat: TabHeartbeat = {
        id: this.tabId,
        role: this.currentRole,
        timestamp: Date.now(),
        generation: this.currentGeneration
      };
      this.channel.postMessage({ type: 'HEARTBEAT', payload: heartbeat });
      this.cleanupStaleTabs();
    }, 1000);
  }

  private handleHeartbeat(heartbeat: TabHeartbeat) {
    this.activeTabs.set(heartbeat.id, heartbeat);
    tabTelemetry.updateActiveTabs(this.activeTabs.size + 1);
  }

  private cleanupStaleTabs() {
    const now = Date.now();
    for (const [id, tab] of this.activeTabs.entries()) {
      if (now - tab.timestamp > 3000) {
        this.activeTabs.delete(id);
        if (tab.role === TabRole.LEADER) {
          tabTelemetry.trackFailover();
          this.electLeader();
        }
      }
    }
  }

  private electLeader() {
    // Simple deterministic election: Lowest Tab ID wins
    const allTabIds = [this.tabId, ...Array.from(this.activeTabs.keys())].sort();
    const winningId = allTabIds[0];

    const newRole = winningId === this.tabId ? TabRole.LEADER : TabRole.FOLLOWER;
    
    if (newRole !== this.currentRole) {
      this.currentRole = newRole;
      tabTelemetry.trackElection();
      
      if (newRole === TabRole.LEADER) {
        this.channel.postMessage({ type: 'LEADER_ANNOUNCEMENT', payload: { id: this.tabId } });
      }
    }
  }

  public handleLeaderAnnouncement(payload: { id: string }) {
    if (payload.id !== this.tabId) {
      this.currentRole = TabRole.FOLLOWER;
    }
  }

  public publishEvent(event: CoordinationEvent) {
    this.channel.postMessage({ type: 'COORDINATION_EVENT', payload: event });
  }

  public onEvent(listener: (event: CoordinationEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleCoordinationEvent(event: CoordinationEvent) {
    this.listeners.forEach(l => l(event));
  }

  public isLeader(): boolean {
    return this.currentRole === TabRole.LEADER;
  }

  public getRole(): TabRole {
    return this.currentRole;
  }

  public getActiveTabsCount(): number {
    return this.activeTabs.size + 1;
  }

  public getTabId(): string {
    return this.tabId;
  }
}

export const tabCoordinator = new TabCoordinator();
