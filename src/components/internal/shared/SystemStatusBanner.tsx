import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export const SystemStatusBanner = () => {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchActiveIncidents();
    fetchActiveAnnouncements();

    const incidentChannel = supabase
      .channel('system_incidents_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'system_incidents' 
      }, () => fetchActiveIncidents())
      .subscribe();

    const policyChannel = supabase
      .channel('platform_policies_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'platform_policies' 
      }, () => fetchActiveAnnouncements())
      .subscribe();

    return () => {
      supabase.removeChannel(incidentChannel);
      supabase.removeChannel(policyChannel);
    };
  }, []);

  const fetchActiveAnnouncements = async () => {
    const { data, error } = await (supabase as any)
      .from('platform_policies')
      .select('*')
      .in('type', ['announcement', 'emergency'])
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      // Filter out "Welcome" announcements for established users
      const filteredAnnouncements = data.filter((a: any) => {
        if (a.title.toLowerCase().includes('welcome')) {
          if (!user) return false; // Don't show welcome to unauthenticated in the banner (keep landing clean)
          
          const userCreatedAt = new Date(user.created_at).getTime();
          const now = new Date().getTime();
          const oneDay = 24 * 60 * 60 * 1000;
          
          return (now - userCreatedAt) < oneDay; // Only show for first 24h
        }
        return true;
      });
      
      setAnnouncements(filteredAnnouncements.slice(0, 1));
    }
  };

  const fetchActiveIncidents = async () => {
    const { data, error } = await (supabase as any)
      .from('system_incidents')
      .select('*')
      .is('resolved_at', null)
      .order('started_at', { ascending: false });

    if (!error && data) {
      setIncidents(data as any[]);
    }
  };

  if (!isVisible) return null;
  if (incidents.length === 0 && announcements.length === 0) return null;

  const incident = incidents[0];
  const announcement = announcements[0];

  // Incident takes priority over announcement
  const activeMessage = incident ? {
    title: incident.title,
    content: incident.impact_description,
    severity: incident.severity,
    type: 'INCIDENT'
  } : {
    title: announcement.title,
    content: announcement.content,
    severity: announcement.type === 'emergency' ? 'critical' : 'low',
    type: announcement.type.toUpperCase()
  };

  const getStyles = () => {
    switch (activeMessage.severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-600 text-white';
      case 'medium': return 'bg-blue-600 text-white';
      default: return 'bg-slate-900 text-white';
    }
  };

  const getIcon = () => {
    if (incident) {
      return incident.status === 'investigating' ? <AlertCircle className="w-4 h-4 animate-pulse" /> : <Info className="w-4 h-4" />;
    }
    return <Info className="w-4 h-4" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`${getStyles()} overflow-hidden relative z-[60]`}
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs md:text-sm font-medium">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">{getIcon()}</div>
            <div className="flex flex-col md:flex-row md:items-center md:gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-white/20 text-white py-0 h-4 text-[8px] font-black">{activeMessage.type}</Badge>
                <span className="font-bold uppercase tracking-tight">{activeMessage.title}</span>
              </div>
              <span className="opacity-90 font-normal line-clamp-1">{activeMessage.content}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
