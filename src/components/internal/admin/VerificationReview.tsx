import React from 'react';
import { 
  BadgeCheck, User, FileText, 
  CheckCircle, XCircle, 
  RefreshCw, Eye, Globe,
  Briefcase, Landmark, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface VerificationRequest {
  id: string;
  user_id: string;
  request_type: 'creator' | 'professional' | 'public_figure' | 'company';
  full_legal_name: string;
  government_id_url?: string;
  supporting_doc_url?: string;
  social_links?: any;
  reason: string;
  status: string;
  created_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
    craft: string | null;
  };
}

interface VerificationReviewProps {
  requests: VerificationRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRefresh: () => void;
}

const TYPE_CONFIG = {
  creator:       { icon: User,     color: 'text-blue-500',   bg: 'bg-blue-500/10' },
  professional:  { icon: Briefcase, color: 'text-emerald-500',bg: 'bg-emerald-500/10' },
  public_figure: { icon: Globe,     color: 'text-purple-500', bg: 'bg-purple-500/10' },
  company:       { icon: Landmark,  color: 'text-amber-500',  bg: 'bg-amber-500/10' },
};

const VerificationReview: React.FC<VerificationReviewProps> = ({ requests, onApprove, onReject, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Verification Queue</h2>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
            Manual Identity & Professional Review
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 rounded-xl gap-2 font-bold text-xs" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4" /> Refresh Queue
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {requests.map((req, index) => {
            const config = TYPE_CONFIG[req.request_type] || TYPE_CONFIG.creator;
            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-6 border-border/50 group hover:border-primary/30 transition-all duration-300"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Profile & Type */}
                  <div className="w-full lg:w-64 space-y-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20">
                        {req.profile.avatar_url ? (
                          <img src={req.profile.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <User className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground">@{req.profile.username}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{req.profile.craft || 'General Member'}</p>
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border border-border/50 ${config.bg}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <config.icon className={`w-4 h-4 ${config.color}`} />
                        <p className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>{req.request_type}</p>
                      </div>
                      <p className="text-[11px] font-bold text-foreground/80 leading-relaxed">
                        Claiming status as a verified {req.request_type.replace('_', ' ')} in the industry.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">Case Metadata</p>
                      <div className="flex flex-col gap-1">
                        <div className="bg-muted/30 px-3 py-1.5 rounded-lg flex items-center justify-between">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">Submitted</span>
                          <span className="text-[10px] font-mono text-foreground font-bold">{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="bg-muted/30 px-3 py-1.5 rounded-lg flex items-center justify-between">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">Platform ID</span>
                          <span className="text-[10px] font-mono text-foreground font-bold">{req.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator orientation="vertical" className="hidden lg:block h-auto mx-2 opacity-30" />

                  {/* Legal Info & Docs */}
                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <Landmark className="w-3 h-3" /> Identity Verification
                        </h3>
                        <div className="p-4 bg-background border border-border/50 rounded-2xl">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Legal Name</p>
                          <p className="text-sm font-bold text-foreground">{req.full_legal_name}</p>
                          
                          <div className="mt-4 flex gap-2">
                            {req.government_id_url && (
                              <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold gap-2 px-3 border-primary/20 text-primary hover:bg-primary/5" asChild>
                                <a href={req.government_id_url} target="_blank" rel="noreferrer">
                                  <FileText className="w-3.5 h-3.5" /> ID DOCUMENT
                                </a>
                              </Button>
                            )}
                            {req.supporting_doc_url && (
                              <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold gap-2 px-3 border-blue-500/20 text-blue-500 hover:bg-blue-500/5" asChild>
                                <a href={req.supporting_doc_url} target="_blank" rel="noreferrer">
                                  <BadgeCheck className="w-3.5 h-3.5" /> PROFESSIONAL DOC
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <History className="w-3 h-3" /> Professional Context
                        </h3>
                        <div className="p-4 bg-background border border-border/50 rounded-2xl h-full">
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Reason for Badge</p>
                          <p className="text-xs text-foreground/80 font-medium leading-relaxed italic">
                            "{req.reason}"
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border/30 flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold gap-1.5 rounded-lg hover:bg-primary/5" asChild>
                          <a href={`/profile/${req.user_id}`} target="_blank" rel="noreferrer">
                            <Eye className="w-3.5 h-3.5" /> Review Full Profile
                          </a>
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-9 rounded-xl border-red-500/20 text-red-500 font-black text-[10px] uppercase tracking-widest px-4 hover:bg-red-500/5"
                          onClick={() => {
                            const reason = prompt('Please provide rejection reason for audit log:');
                            if (reason) onReject(req.id, reason);
                          }}>
                          <XCircle className="w-4 h-4 mr-2" /> Reject Request
                        </Button>
                        <Button variant="default" size="sm" className="h-9 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-[10px] uppercase tracking-widest px-6 shadow-lg shadow-green-600/20"
                          onClick={() => onApprove(req.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Approve Badge
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {requests.length === 0 && (
          <div className="py-24 text-center glass-card border-dashed border-2">
            <BadgeCheck className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight">Queue Depleted</h3>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">All verification requests have been processed.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationReview;

const Separator = ({ orientation = 'horizontal', className = '', ...props }) => (
  <div
    className={`shrink-0 bg-border ${orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]'} ${className}`}
    {...props}
  />
);
