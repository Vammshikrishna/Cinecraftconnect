import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Key, Copy, Plus } from 'lucide-react';

export default function VIPInviteManager() {
  const [invites, setInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    const { data, error } = await supabase
      .from('vip_invites' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (!error && data) {
      setInvites(data);
    }
  };

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'VIP-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createInvite = async () => {
    if (!user) return;
    setIsLoading(true);
    const code = generateInviteCode();
    
    try {
      const { error } = await supabase.from('vip_invites' as any).insert({
        code,
        created_by: user.id,
        role_granted: 'creator_pro'
      });

      if (error) throw error;

      toast({
        title: "VIP Invite Created",
        description: `Code ${code} is ready to be shared.`
      });
      fetchInvites();
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-6 bg-card/50 border border-border/50 rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 mb-2">
            <Crown className="text-yellow-500" /> VIP Invite Generator
          </h2>
          <p className="text-muted-foreground text-sm">
            Generate single-use invite codes to bypass the waitlist and grant instant Pro status.
          </p>
        </div>
        <Button onClick={createInvite} disabled={isLoading} className="font-bold bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Generate Code
        </Button>
      </div>

      <div className="pt-2 space-y-3">
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">No invites generated yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {invites.map((invite) => (
              <div key={invite.code} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-white/5 shadow-inner">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono font-bold text-lg text-primary tracking-wider">
                    <Key size={16} className="text-muted-foreground" />
                    {invite.code}
                  </div>
                  <Badge variant="outline" className={invite.is_used ? 'text-muted-foreground border-border' : 'text-green-500 border-green-500/30 bg-green-500/10'}>
                    {invite.is_used ? 'Claimed' : 'Available'}
                  </Badge>
                </div>
                
                {!invite.is_used && (
                  <Button variant="ghost" size="icon" onClick={() => copyCode(invite.code)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
