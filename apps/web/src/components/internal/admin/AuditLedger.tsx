import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { History, Search, Shield, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { csvRow } from '../shared/staffHelpers';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const PAGE = 100;


/** Everything staff did, written by the database itself (audit_logs). Search, filter by action and date, and export. */
const AuditLedger = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [filter, setFilter] = useState('');
  const [action, setAction] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      let q = (supabase as any).from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (from) q = q.gte('created_at', new Date(from).toISOString());
      if (to) q = q.lte('created_at', new Date(new Date(to).getTime() + 86400000).toISOString());
      const { data } = await q;
      if (!alive) return;
      const rows = data || [];
      setLogs(rows);
      // names for everyone mentioned in a row: the actor, the person acted on, and the maker / checker of a two-person decision
      const ids = Array.from(new Set(rows.flatMap((r: any) => [r.actor_id, r.target_type === 'user' ? r.target_id : null, r.metadata?.maker_id, r.metadata?.checker_id]).filter((x: any) => typeof x === 'string' && x.length === 36))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username').in('id', ids);
        if (alive) setNames(Object.fromEntries((profs || []).map((p: any) => [p.id, p.username || p.id.slice(0, 8)])));
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [limit, from, to]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs]);

  // a person-friendly one-liner for a log row (the raw JSON stays available on hover and in the CSV)
  const nameOf = (id?: string) => (id ? `@${names[id] || String(id).slice(0, 8)}` : '');
  const describe = (l: any): string => {
    const m = l.metadata || {};
    const parts: string[] = [];
    if (l.target_type === 'user' && l.target_id) parts.push(`on ${nameOf(l.target_id)}`);
    if (m.role) parts.push(`role ${String(m.role).replace('_', ' ')}`);
    if (m.reason) parts.push(`reason: ${m.reason}`);
    if (m.maker_id) parts.push(`asked by ${nameOf(m.maker_id)}`);
    if (m.checker_id) parts.push(`decided by ${nameOf(m.checker_id)}`);
    return parts.join(' · ');
  };

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return logs.filter((l) => {
      if (action !== 'all' && l.action !== action) return false;
      if (!term) return true;
      const hay = [l.action, l.actor_role, names[l.actor_id], l.actor_id, l.target_type, l.target_id, JSON.stringify(l.metadata || {})].join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [logs, filter, action, names]);

  const exportCsv = () => {
    const head = ['time', 'actor', 'role', 'action', 'target_type', 'target_id', 'details'];
    const lines = [csvRow(head)].concat(
      shown.map((l) => csvRow([l.created_at, names[l.actor_id] || l.actor_id, l.actor_role, l.action, l.target_type, l.target_id, JSON.stringify(l.metadata || {})]))
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> Audit log
          </h2>
          <p className="text-xs text-muted-foreground uppercase font-medium tracking-widest mt-1">
            Every staff action, recorded by the database
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search actor, target, details…" className="pl-9 h-9 text-xs rounded-xl border-border/50" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          <select
            aria-label="Filter by action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-xl border border-border/50 bg-background px-3 text-xs"
          >
            <option value="all">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <Input type="date" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36 text-xs rounded-xl border-border/50" />
          <Input type="date" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36 text-xs rounded-xl border-border/50" />
          <Button variant="outline" size="sm" className="h-9 rounded-xl gap-2" onClick={exportCsv} disabled={shown.length === 0}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="glass-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30 border-b border-border/50">
            <TableRow>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4 pl-6">Time</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Who</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Action</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4">Target</TableHead>
              <TableHead className="text-[12px] font-black uppercase tracking-widest py-4 pr-6">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground italic">Nothing matches.</TableCell>
              </TableRow>
            ) : shown.map((log) => (
              <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b border-border/10">
                <TableCell className="pl-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-[12px] font-bold text-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
                    <span className="text-[12px] text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-primary" /></div>
                    <div>
                      <p className="text-[12px] font-black tracking-tight">@{names[log.actor_id] || (log.actor_id ? String(log.actor_id).slice(0, 8) : 'system')}</p>
                      <p className="text-[12px] text-muted-foreground uppercase font-medium">{log.actor_role || 'staff'}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[12px] font-black uppercase px-2 py-0.5">
                    {String(log.action).replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-[12px] font-bold uppercase">{log.target_type}</p>
                  <p className="text-[12px] text-muted-foreground font-mono">{String(log.target_id || '').slice(0, 13)}</p>
                </TableCell>
                <TableCell className="pr-6 max-w-[360px]">
                  <p
                    className={`text-[12px] text-muted-foreground line-clamp-2 break-words ${describe(log) ? '' : 'font-mono break-all'}`}
                    title={log.metadata ? JSON.stringify(log.metadata) : undefined}
                  >
                    {describe(log) || (log.metadata ? JSON.stringify(log.metadata) : '')}
                  </p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {logs.length >= limit && (
          <div className="p-3 text-center border-t border-border/30">
            <Button variant="ghost" size="sm" className="text-xs font-bold" onClick={() => setLimit((n) => n + PAGE)}>Load older entries</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLedger;
