import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  History, Search, Filter, 
  Shield, ArrowRight, FileJson
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, 
  TableHead, TableHeader, TableRow 
} from '@/components/ui/table';

const AuditLedger = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('gov_audit_ledger')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (data) setLogs(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Forensic Audit Ledger
          </h2>
          <p className="text-xs text-muted-foreground uppercase font-medium tracking-widest mt-1">
            Immutable record of all governance operations
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by actor or target..." 
              className="pl-9 h-9 text-xs rounded-xl border-border/50"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-2">
            <Filter className="w-4 h-4" /> Filter
          </Button>
        </div>
      </div>

      <div className="glass-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30 border-b border-border/50">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-6">Timestamp</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Actor</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Action</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Target</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">State Change</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pr-6">Trace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground italic">
                  No governance actions recorded in the ledger.
                </TableCell>
              </TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b border-border/10">
                <TableCell className="pl-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-foreground">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black tracking-tight">Staff: {log.actor_id.slice(0, 8)}</p>
                      <p className="text-[9px] text-muted-foreground uppercase font-medium">{log.role || 'Personnel'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[9px] font-black uppercase px-2 py-0.5">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">{log.target_type}</p>
                    <p className="text-[9px] text-muted-foreground font-mono">ID: {log.target_id.slice(0, 8)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[8px] font-bold">PRE</div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <div className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 text-[8px] font-bold">POST</div>
                  </div>
                </TableCell>
                <TableCell className="pr-6">
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                    <FileJson className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AuditLedger;
