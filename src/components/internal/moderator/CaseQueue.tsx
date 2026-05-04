import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flag, AlertTriangle, User, MessageSquare, 
  Briefcase, ShoppingBag, ChevronRight,
  Shield, MoreHorizontal,
  ThumbsUp, Trash2, Ban, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Case {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  reporter: { username: string; avatar_url: string | null };
  details: string;
}

interface CaseQueueProps {
  cases: Case[];
  onSelectCase: (caseId: string) => void;
  selectedCaseId?: string | null;
}

const TARGET_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  post:    { icon: MessageSquare, color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
  comment: { icon: MessageSquare, color: 'text-sky-500',    bg: 'bg-sky-500/10'     },
  user:    { icon: User,          color: 'text-purple-500', bg: 'bg-purple-500/10'  },
  job:     { icon: Briefcase,     color: 'text-emerald-500',bg: 'bg-emerald-500/10' },
  listing: { icon: ShoppingBag,   color: 'text-orange-500', bg: 'bg-orange-500/10'  },
};

const PRIORITY_STYLES = {
  low:    'bg-muted text-muted-foreground border-border/50',
  medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  high:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  urgent: 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse',
};

const CaseQueue: React.FC<CaseQueueProps> = ({ cases, onSelectCase, selectedCaseId }) => {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Active Cases</h2>
            <Badge variant="outline" className="rounded-lg text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
              {cases.length} Total
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase tracking-widest gap-2">
              <Shield className="w-3.5 h-3.5" /> Bulk Actions
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {cases.map((item, index) => {
              const config = TARGET_CONFIG[item.target_type] || { icon: Flag, color: 'text-muted-foreground', bg: 'bg-muted' };
              const isSelected = selectedCaseId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onSelectCase(item.id)}
                  className={`group relative glass-card p-4 flex items-center gap-5 cursor-pointer transition-all duration-300 ${
                    isSelected ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : 'hover:bg-muted/50 border-border/50'
                  }`}
                >
                  <div className={`w-12 h-12 ${config.bg} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                    <config.icon className={`w-6 h-6 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border uppercase tracking-widest ${PRIORITY_STYLES[item.priority]}`}>
                        {item.priority}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">#{item.id.slice(0, 8)}</span>
                      <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest">•</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <h3 className="text-sm font-bold text-foreground line-clamp-1 mb-0.5">
                      {item.reason.replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3 h-3" /> @{item.reporter.username}
                        <Badge variant="outline" className={`h-4 px-1 text-[8px] font-black border-none ${
                          (item as any).reporter_trust_score > 80 ? 'bg-green-500/10 text-green-500' :
                          (item as any).reporter_trust_score < 40 ? 'bg-red-500/10 text-red-500' :
                          'bg-amber-500/10 text-amber-500'
                        }`}>
                          TRUST: {(item as any).reporter_trust_score || 100}
                        </Badge>
                      </span>
                      <span>•</span>
                      <span className="capitalize">{item.target_type} Report</span>
                      {item.priority === 'urgent' && (
                        <>
                          <span>•</span>
                          <span className="text-red-500 font-black animate-pulse uppercase tracking-tighter">AI Prioritized</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl border-border">
                        <DropdownMenuItem className="rounded-lg gap-2 text-xs font-bold text-green-500 hover:bg-green-500/10">
                          <ThumbsUp className="w-3.5 h-3.5" /> Dismiss Case
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2 text-xs font-bold text-amber-500 hover:bg-amber-500/10">
                          <AlertTriangle className="w-3.5 h-3.5" /> Issue Warning
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2 text-xs font-bold text-red-500 hover:bg-red-500/10">
                          <Trash2 className="w-3.5 h-3.5" /> Delete Content
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg gap-2 text-xs font-bold text-red-600 hover:bg-red-600/10">
                          <Ban className="w-3.5 h-3.5" /> Ban User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                    }`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {cases.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-muted/50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border/50">
                <CheckCircle className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Queue Clear</h3>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">No pending cases in this queue.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseQueue;
