import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserPlus } from 'lucide-react';
import { useAppNavigation } from '@/contexts/NavigationContext';

interface Props {
  onConnect: (id: string, name: string, defaultNote: string) => void;
}

/** "People you've worked with": members of your project spaces you are not connected to yet. */
export const CollaboratorsRow = ({ onConnect }: Props) => {
  const { user } = useAuth();
  const { push } = useAppNavigation();
  const { data: people = [] } = useQuery({
    queryKey: ['collaborators', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc('suggest_collaborators', { p_limit: 12 });
      return (data || []) as any[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => setHidden(new Set()), [people]);

  const visible = people.filter(p => !hidden.has(p.id));
  if (visible.length === 0) return null;

  return (
    <Card className="bg-card/40 backdrop-blur-md border-border/50 shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <h2 className="text-lg font-semibold">People you've worked with</h2>
        <p className="text-xs text-muted-foreground">From your project spaces. Connect to keep in touch.</p>
      </div>
      <div className="flex gap-3 overflow-x-auto px-5 pb-4 pt-2" style={{ scrollbarWidth: 'none' }}>
        {visible.map(p => (
          <div key={p.id} className="w-40 shrink-0 rounded-xl border bg-background/50 p-3 text-center space-y-1.5">
            <button onClick={() => push(`/profile/${p.id}`)} className="block mx-auto">
              <Avatar className="h-14 w-14 mx-auto">
                <AvatarImage src={p.avatar_url || undefined} />
                <AvatarFallback>{(p.full_name || p.username || '?')[0]}</AvatarFallback>
              </Avatar>
            </button>
            <p className="text-sm font-semibold line-clamp-1">{p.full_name || p.username}</p>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{p.craft || 'Filmmaker'}</p>
            <p className="text-[10px] text-primary line-clamp-1" title={p.shared_title}>
              {p.shared_count > 1 ? `${p.shared_count} projects together` : p.shared_title}
            </p>
            <Button size="sm" className="w-full h-7 text-[11px]" onClick={() => onConnect(p.id, p.full_name || p.username || 'this person', `Worked together on ${p.shared_title}`)}>
              <UserPlus className="h-3 w-3 mr-1" /> Connect
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
