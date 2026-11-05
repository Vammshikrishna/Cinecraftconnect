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
    try {
      const { data, error } = await (supabase as any)
        .from('platform_policies')
        .select('*')
        .in('type', ['announcement', 'emergency'])
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        // Filter out "Welcome" announcements for established users
        const filteredAnnouncements = data.filter((a: any) => {
          if (a.title && a.title.toLowerCase().includes('welcome')) {
            if (!user) return false;
            
            const userCreatedAt = new Date(user.created_at).getTime();
            const now = new Date().getTime();
            const oneDay = 24 * 60 * 60 * 1000;
            
            return (now - userCreatedAt) < oneDay;
          }
          return true;
        });
        
        setAnnouncements(filteredAnnouncements.slice(0, 1));
      }
    } catch (e) {
      // Catch 401 or RLS permission errors silently
      setAnnouncements([]);
    }
  };

  const fetchActiveIncidents = async () => {
    try {
      // system_incidents is not readable by anonymous visitors; the public_status() function returns the public view of it
      const { data, error } = await (supabase as any).rpc('public_status');
      const list = !error && Array.isArray(data?.incidents) ? data.incidents : null;
      if (list) {
        setIncidents(list
          .filter((i: any) => !i.resolved_at)
          .map((i: any) => ({ ...i, impact_description: i.updates?.[0]?.message ?? '' })));
      }
    } catch (e) {
      setIncidents([]);
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
      return incident.status === 'investigating' ? <AlertCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />;
    }
    return <Info className="w-4 h-4" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        role="status"
        className={`${getStyles()} fixed z-[60] left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] lg:left-auto lg:right-6 lg:bottom-6 lg:w-[460px] rounded-2xl shadow-xl`}
      >
        <div className="px-4 py-3 flex items-start justify-between text-sm font-medium">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-white/20 text-white py-0 h-4 text-xs font-black">{activeMessage.type}</Badge>
                <span className="font-semibold">{activeMessage.title}</span>
              </div>
              <span className="opacity-90 font-normal line-clamp-2">{activeMessage.content}</span>
            </div>
          </div>
          <button aria-label="Close" 
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-foreground/10 rounded-full transition-colors ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
