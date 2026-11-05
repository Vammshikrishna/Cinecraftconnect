import React from 'react';
import { 
  Inbox, Shield, Users, Clock, CheckCircle, 
  AlertTriangle, MessageSquare, Briefcase, 
  ShoppingBag, Search, NotebookPen, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ModeratorSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  counts: Record<string, number>;
  /** the search box filters the queue on the right */
  query?: string;
  onQueryChange?: (q: string) => void;
  /** jump to the cases that are late or due within the hour */
  onSla?: (sla: 'overdue' | 'soon') => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ModeratorSidebar: React.FC<ModeratorSidebarProps> = ({
  activeTab,
  setActiveTab,
  counts,
  query = '',
  onQueryChange,
  onSla,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const menuItems = [
    { id: 'my_day', label: 'My day', icon: Clock, color: 'text-primary' },
    { id: 'second_review', label: 'Second review', icon: CheckCircle, color: 'text-primary/70' },
    { id: 'handover', label: 'Shift handover', icon: NotebookPen, color: 'text-primary/70' },
    { id: 'all_cases', label: 'All Cases', icon: Inbox, color: 'text-foreground' },
    { id: 'pending', label: 'Pending Review', icon: Clock, color: 'text-primary/60', count: counts.pending },
    { id: 'priority', label: 'Urgent Cases', icon: AlertTriangle, color: 'text-primary', count: counts.urgent },
  ];

  const contentQueues = [
    { id: 'feed', label: 'Social Feed', icon: MessageSquare, color: 'text-primary/70' },
    { id: 'jobs', label: 'Jobs & Auditions', icon: Briefcase, color: 'text-primary/70' },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, color: 'text-primary/70' },
    { id: 'users', label: 'User Reports', icon: Users, color: 'text-primary/70' },
    { id: 'messages', label: 'Reported Messages', icon: MessageSquare, color: 'text-primary/70' },
  ];

  const resolved = [
    { id: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'text-primary/50' },
    { id: 'dismissed', label: 'Dismissed', icon: CheckCircle, color: 'text-muted-foreground/40' },
  ];

  return (
    <aside className="bg-card/50 flex flex-col h-full overflow-hidden transition duration-300">
      {/* Top Toggle & Search Area */}
      <div className="p-4 flex flex-col gap-4">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} px-2`}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <Shield className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[12px] font-black uppercase tracking-widest text-primary/80">Operations</span>
            </div>
          )}
          <button 
            onClick={onToggleCollapse}
            className="p-2 hover:bg-primary/10 rounded-xl text-muted-foreground hover:text-primary transition active:scale-90"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {!isCollapsed && (
          <div className="relative px-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input 
              className="w-full bg-background/40 border border-border/50 rounded-2xl py-2.5 pl-10 pr-4 text-[12px] font-medium outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition"
              placeholder="Search Reports..."
              aria-label="Search reports"
              value={query}
              onChange={(e) => onQueryChange?.(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 pt-0 flex flex-col gap-8">
          <div className="space-y-3">
            {!isCollapsed && (
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-4">Console</p>
            )}
            {!isCollapsed && ((counts.overdue || 0) > 0 || (counts.soon || 0) > 0) && (
              <div className="flex gap-2 px-2" role="group" aria-label="Response deadlines">
                <button type="button" onClick={() => onSla?.('overdue')} className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-left" aria-label={`${counts.overdue || 0} cases overdue`}>
                  <span className="block text-lg font-black leading-none text-red-500 tabular-nums">{counts.overdue || 0}</span>
                  <span className="text-[12px] font-bold text-red-500/80">Overdue</span>
                </button>
                <button type="button" onClick={() => onSla?.('soon')} className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left" aria-label={`${counts.soon || 0} cases due within an hour`}>
                  <span className="block text-lg font-black leading-none text-amber-600 tabular-nums">{counts.soon || 0}</span>
                  <span className="text-[12px] font-bold text-amber-600/80">Due in 1h</span>
                </button>
              </div>
            )}
            <div className="space-y-1 px-1">
              {menuItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-2xl text-[12px] font-bold transition duration-300 group/btn ${
                    activeTab === item.id 
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5' 
                      : 'text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110 ${item.color}`} />
                    {!isCollapsed && <span className="tracking-tight">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.count !== undefined && item.count > 0 && (
                    <Badge className="bg-primary/20 text-primary border-none text-[12px] px-2 h-5 min-w-[20px] justify-center rounded-lg font-black">
                      {item.count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {!isCollapsed && (
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-4">Queues</p>
            )}
            <div className="space-y-1 px-1">
              {contentQueues.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-2xl text-[12px] font-bold transition duration-300 group/btn ${
                    activeTab === item.id 
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5' 
                      : 'text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110 ${item.color}`} />
                    {!isCollapsed && <span className="tracking-tight">{item.label}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {!isCollapsed && (
              <p className="text-[12px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-4">History</p>
            )}
            <div className="space-y-1 px-1">
              {resolved.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-2.5'} rounded-2xl text-[12px] font-bold transition duration-300 group/btn ${
                    activeTab === item.id 
                      ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5' 
                      : 'text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 transition-transform duration-300 group-hover/btn:scale-110 ${item.color}`} />
                    {!isCollapsed && <span className="tracking-tight">{item.label}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {!isCollapsed && (
          <div className="mt-8 px-1">
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 overflow-hidden relative group/guard">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover/guard:opacity-100 transition-opacity" />
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <Shield className="w-4 h-4 text-primary" />
                <p className="text-[12px] font-black text-primary uppercase tracking-widest">Active Guard</p>
              </div>
              <p className="text-[12px] text-primary/60 font-medium leading-relaxed relative z-10">
                Your moderation actions are recorded in the audit log.
              </p>
            </div>
          </div>
        )}
    </aside>
  );
};

export default ModeratorSidebar;
