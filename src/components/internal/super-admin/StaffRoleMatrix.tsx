import React from 'react';
import { 
  Shield, ShieldCheck, Crown, 
  User, UserPlus, UserMinus,
  Activity, Key, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StaffMember {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  role: 'moderator' | 'admin' | 'super_admin';
  last_active?: string;
}

interface StaffRoleMatrixProps {
  staff: StaffMember[];
  onPromote: (userId: string, newRole: string) => void;
  onRevoke: (userId: string) => void;
}

const ROLE_CONFIG = {
  moderator:   { icon: Shield,      color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Moderator' },
  admin:       { icon: ShieldCheck, color: 'text-blue-500',   bg: 'bg-blue-500/10',   label: 'Admin' },
  super_admin: { icon: Crown,       color: 'text-amber-500',  bg: 'bg-amber-500/10',  label: 'Super Admin' },
};

const StaffRoleMatrix: React.FC<StaffRoleMatrixProps> = ({ staff, onPromote, onRevoke }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Staff Role Matrix</h2>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
            Global Permission & Access Governance
          </p>
        </div>
        <Button className="h-9 rounded-xl gap-2 font-bold text-xs bg-primary hover:bg-primary/90 text-white px-6">
          <UserPlus className="w-4 h-4" /> Provision New Staff
        </Button>
      </div>

      <div className="glass-card overflow-hidden border-border/50">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Identity</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Scope</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trust Level</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Operations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {staff.map((member) => {
              const config = ROLE_CONFIG[member.role];
              return (
                <tr key={member.id} className="hover:bg-muted/10 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center overflow-hidden border border-border/50">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">@{member.username}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{member.full_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/50 ${config.bg}`}>
                      <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2 max-w-[200px]">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter text-muted-foreground mb-1">
                        <span>Access Level</span>
                        <span className={config.color}>{member.role === 'super_admin' ? 'ROOT' : 'RESTRICTED'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${config.bg.replace('/10', '')}`} 
                          style={{ width: member.role === 'super_admin' ? '100%' : member.role === 'admin' ? '70%' : '40%' }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Activity className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Key className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Separator orientation="vertical" className="h-4 mx-1" />
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold border-red-500/20 text-red-500 hover:bg-red-500/5 px-3"
                        onClick={() => onRevoke(member.id)}
                        disabled={member.role === 'super_admin'}
                      >
                        <UserMinus className="w-3.5 h-3.5 mr-2" /> Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {staff.length === 0 && (
          <div className="py-20 text-center">
            <ShieldAlert className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-tight">No Staff Provisioned</h3>
            <p className="text-[11px] text-muted-foreground font-medium mt-1">Initialize the governance layer to assign roles.</p>
          </div>
        )}
      </div>

      {/* Permissions Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Shield, title: 'Moderator', desc: 'Case resolution, content removal, warnings, muted users.', color: 'text-purple-500' },
          { icon: ShieldCheck, title: 'Admin', desc: 'Verification, billing, appeals, staff view, unban users.', color: 'text-blue-500' },
          { icon: Crown, title: 'Super Admin', desc: 'Policy rules, role management, root security, feature flags.', color: 'text-amber-500' },
        ].map((p, i) => (
          <div key={i} className="glass-card p-5 border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <p.icon className={`w-4 h-4 ${p.color}`} />
              <h4 className="text-xs font-black uppercase tracking-widest">{p.title} Scope</h4>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
              {p.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StaffRoleMatrix;

const Separator = ({ orientation = 'horizontal', className = '', ...props }) => (
  <div
    className={`shrink-0 bg-border ${orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]'} ${className}`}
    {...props}
  />
);
