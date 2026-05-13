import React from 'react';
import { Monitor, Smartphone, AlertTriangle, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

export interface SessionData {
  id: string;
  device_name: string | null;
  platform: string | null;
  ip_address: string | null;
  last_active_at: string;
  is_current: boolean;
  suspicious: boolean;
  trusted: boolean;
  device_id: string;
}

interface SessionCardProps {
  session: SessionData;
  onRevoke: (sessionId: string) => void;
  isRevoking: boolean;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session, onRevoke, isRevoking }) => {
  const isMobile = session.platform === 'ios' || session.platform === 'android' || session.device_name?.toLowerCase().includes('mobile');
  
  return (
    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
      session.is_current ? 'border-primary/50 bg-primary/5' : 'border-border bg-card'
    } ${session.suspicious ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <div className="flex items-start sm:items-center space-x-4">
        <div className="p-3 bg-muted rounded-full shrink-0">
          {isMobile ? <Smartphone className="w-6 h-6 text-foreground" /> : <Monitor className="w-6 h-6 text-foreground" />}
        </div>
        
        <div>
          <h4 className="font-semibold text-foreground flex flex-wrap items-center gap-2">
            {session.device_name || 'Unknown Device'}
            {session.is_current && (
              <span className="text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                This Device
              </span>
            )}
            {session.suspicious && (
              <span className="text-[10px] uppercase tracking-wider bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Suspicious
              </span>
            )}
          </h4>
          
          <div className="text-sm text-muted-foreground mt-1 flex flex-col gap-0.5">
            <span>{session.platform} {session.ip_address ? `• ${session.ip_address}` : ''}</span>
            <span className="flex items-center gap-1">
              {session.is_current ? (
                 <span className="text-green-500 flex items-center gap-1 text-xs"><ShieldCheck className="w-3 h-3"/> Active now</span>
              ) : (
                 `Last active ${formatDistanceToNow(new Date(session.last_active_at))} ago`
              )}
            </span>
          </div>
        </div>
      </div>
      
      {!session.is_current && (
        <Button 
          variant="outline" 
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 self-start sm:self-auto"
          onClick={() => onRevoke(session.id)}
          disabled={isRevoking}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Log Out Device
        </Button>
      )}
    </div>
  );
};
