import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, ShieldCheck, Crown, 
  User, UserPlus, UserMinus,
  Activity, Key, ShieldAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  onPromote: (userId: string, role: string, metadata?: { username: string; fullName: string }) => void;
  onRevoke: (userId: string, role: string) => void;
}

const ROLE_CONFIG = {
  moderator:   { icon: Shield,      color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Moderator' },
  admin:       { icon: ShieldCheck, color: 'text-blue-500',   bg: 'bg-blue-500/10',   label: 'Admin' },
  super_admin: { icon: Crown,       color: 'text-amber-500',  bg: 'bg-amber-500/10',  label: 'Super Admin' },
};

const StaffRoleMatrix: React.FC<StaffRoleMatrixProps> = ({ staff, onPromote, onRevoke }) => {
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionMethod, setProvisionMethod] = useState('new'); // 'new' | 'existing'
  const [provisionId, setProvisionId] = useState('');
  
  // New user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [provisionRole, setProvisionRole] = useState('moderator');

  const handleProvisionSubmit = async () => {
    setIsProvisioning(true);
    try {
      if (provisionMethod === 'existing') {
        if (!provisionId.trim()) {
          throw new Error('Username is required');
        }
        
        // Treat provisionId as username and lookup UUID
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', provisionId.trim())
          .maybeSingle();
          
        if (profileError || !profileData) {
          throw new Error(`Could not find a user with username or email: ${provisionId.trim()}`);
        }
        
        // Promote existing user using the resolved UUID
        onPromote(profileData.id, provisionRole);
      } else {
        // Create new user
        if (!email || !password || !username || !fullName) {
          throw new Error('All fields are required');
        }
        
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false
            }
          }
        );

        const { data, error } = await tempClient.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              user_name: username, // Redundant key for trigger compatibility
              full_name: fullName,
              display_name: fullName, // Redundant key for trigger compatibility
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // Wait briefly for triggers to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Promote the newly created user with explicit metadata to ensure sync
          onPromote(data.user.id, provisionRole, { username, fullName });
        }
      }

      // Reset form
      setIsProvisionOpen(false);
      setEmail('');
      setPassword('');
      setUsername('');
      setFullName('');
      setProvisionId('');
      setProvisionRole('moderator');
    } catch (e: any) {
      console.error("Provisioning error:", e);
      alert(e.message || "Failed to provision staff");
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Staff Role Matrix</h2>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
            Global Permission & Access Governance
          </p>
        </div>
        <Button 
          onClick={() => setIsProvisionOpen(true)}
          className="h-9 rounded-xl gap-2 font-bold text-xs bg-primary hover:bg-primary/90 text-white px-6"
        >
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
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {member.username && member.username !== 'no_username' ? `@${member.username}` : (member.full_name || 'Staff Member')}
                        </p>
                        {member.username && member.username !== 'no_username' && (
                          <p className="text-[10px] text-muted-foreground font-medium truncate">{member.full_name || 'Internal Staff'}</p>
                        )}
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
                        onClick={() => onRevoke(member.id, member.role)}
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

      <Dialog open={isProvisionOpen} onOpenChange={setIsProvisionOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem] border-border/50 glass-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Provision Staff</DialogTitle>
            <DialogDescription className="text-xs font-medium">
              Create a new internal user account or promote an existing platform user.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={provisionMethod} onValueChange={setProvisionMethod} className="w-full mt-2">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="new" className="rounded-lg text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Create Account</TabsTrigger>
              <TabsTrigger value="existing" className="rounded-lg text-xs font-bold data-[state=active]:bg-primary data-[state=active]:text-white">Promote Existing</TabsTrigger>
            </TabsList>
            
            <TabsContent value="new" className="mt-4">
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Email</label>
                  <Input 
                    type="email"
                    placeholder="staff@cinecraft.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-2xl bg-muted/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Temporary Password</label>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-2xl bg-muted/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Username</label>
                  <Input 
                    placeholder="admin_john" 
                    value={username}
                    onChange={(e) => {
                      const sanitized = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, '')
                        .slice(0, 20);
                      setUsername(sanitized);
                    }}
                    className="rounded-2xl bg-muted/50 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Full Name</label>
                  <Input 
                    placeholder="John Doe" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-2xl bg-muted/50 border-border/50"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="existing" className="mt-4">
              <div className="space-y-2 py-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Username</label>
                <Input 
                  placeholder="e.g., cinecraft_admin"  
                  value={provisionId}
                  onChange={(e) => setProvisionId(e.target.value)}
                  className="rounded-2xl bg-muted/50 border-border/50"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2 mt-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Internal Role</label>
            <Select value={provisionRole} onValueChange={setProvisionRole}>
              <SelectTrigger className="w-full rounded-2xl bg-muted/50 border-border/50">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-4">
            <Button disabled={isProvisioning} variant="outline" onClick={() => setIsProvisionOpen(false)} className="rounded-xl font-bold text-xs px-6">Cancel</Button>
            <Button disabled={isProvisioning} onClick={handleProvisionSubmit} className="rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-white px-6">
              {isProvisioning ? 'Processing...' : (provisionMethod === 'new' ? 'Create & Provision' : 'Promote')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
