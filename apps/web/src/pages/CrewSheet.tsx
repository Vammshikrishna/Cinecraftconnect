import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2 } from 'lucide-react';
import { AvailabilityBadge } from '@/components/network/AvailabilityBadge';

/** A one-page crew sheet built from the public profile. Print it or save it as a PDF. */
const CrewSheet = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!identifier) return;
      const db = supabase as any;
      const { data: id } = await db.rpc('resolve_profile_id', { p_identifier: identifier });
      if (!id) { setLoading(false); return; }
      const [prof, high, creds, skills, avail, awards] = await Promise.all([
        db.from('profiles').select('id, username, full_name, craft, location, bio, avatar_url, is_verified, account_type').eq('id', id).maybeSingle(),
        db.from('profile_highlights').select('*').eq('user_id', id).maybeSingle(),
        db.from('project_credits').select('role, project_title').eq('user_id', id).eq('status', 'accepted').order('created_at', { ascending: false }).limit(6),
        db.from('user_skills').select('skill_name').eq('user_id', id).limit(12),
        db.rpc('get_profile_availability', { p_user: id }),
        db.from('profile_awards').select('kind, title, org, year').eq('user_id', id).order('year', { ascending: false, nullsFirst: false }).limit(4),
      ]);
      setD({ profile: prof.data, highlights: high.data, credits: creds.data || [], skills: skills.data || [], availability: avail.data, awards: awards.data || [] });
      setLoading(false);
    })();
  }, [identifier]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!d?.profile) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">This crew sheet is not available.</div>;

  const p = d.profile, h = d.highlights, av = d.availability;
  const url = `${window.location.origin}/profile/${p.username || p.id}`;
  const rate = av && (av.rate_min != null || av.rate_max != null) ? `${av.rate_currency} ${av.rate_min ?? ''}${av.rate_max != null ? ` - ${av.rate_max}` : '+'} / day` : null;

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 56;
    const line = (text: string, size = 11, bold = false, gap = 16) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, 480);
      doc.text(lines, 56, y);
      y += lines.length * (size + 3) + (gap - size);
    };
    line(p.full_name || p.username, 24, true, 30);
    line([p.craft, p.location].filter(Boolean).join('  |  '), 12, false, 22);
    if (av?.status === 'open') line('Open to work' + (rate ? `  |  ${rate}` : ''), 11, true, 20);
    if (av?.status === 'booked') line('Currently booked' + (av.booked_until ? ` until ${new Date(av.booked_until).toLocaleDateString()}` : ''), 11, true, 20);
    if (p.bio) line(p.bio, 11, false, 22);
    if (d.credits.length) { line('Selected credits', 13, true, 20); d.credits.forEach((c: any) => line(`${c.role} - ${c.project_title}`, 11, false, 15)); y += 8; }
    if (d.skills.length) { line('Skills', 13, true, 20); line(d.skills.map((s: any) => s.skill_name).join(', '), 11, false, 20); }
    if (h?.languages?.length) line('Languages: ' + h.languages.join(', '), 11, false, 18);
    if (h?.gear?.length) line('Gear: ' + h.gear.join(', '), 11, false, 18);
    if (d.awards.length) { y += 6; line('Awards & press', 13, true, 20); d.awards.forEach((a: any) => line(`${a.title}${a.org ? ' - ' + a.org : ''}${a.year ? ' (' + a.year + ')' : ''}`, 11, false, 15)); }
    y += 10;
    if (h?.showreel_url) line('Showreel: ' + h.showreel_url, 10, false, 15);
    line('Profile: ' + url, 10, false, 15);
    doc.save(`${(p.username || 'crew-sheet')}-crew-sheet.pdf`);
  };

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4 print:bg-white print:p-0">
      <div className="max-w-2xl mx-auto mb-4 flex gap-2 print:hidden">
        <Button onClick={downloadPdf}><Download className="h-4 w-4 mr-1.5" /> Download PDF</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1.5" /> Print</Button>
      </div>

      <div className="max-w-2xl mx-auto bg-white text-black rounded-xl shadow-lg print:shadow-none p-10 space-y-5">
        <div className="flex items-start gap-5">
          {p.avatar_url && <img src={p.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover border" crossOrigin="anonymous" />}
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight">{p.full_name || p.username}</h1>
            <p className="text-sm text-neutral-600">{[p.craft, p.location].filter(Boolean).join('  ·  ')}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <AvailabilityBadge status={av?.status} />
              {rate && av?.status === 'open' && <span className="text-xs font-semibold">{rate}</span>}
            </div>
          </div>
        </div>

        {p.bio && <p className="text-sm leading-relaxed">{p.bio}</p>}

        {d.credits.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-1.5">Selected credits</h2>
            <ul className="text-sm space-y-0.5">{d.credits.map((c: any, i: number) => <li key={i}><b>{c.role}</b> · {c.project_title}</li>)}</ul>
          </section>
        )}
        {d.skills.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-1.5">Skills</h2>
            <p className="text-sm">{d.skills.map((s: any) => s.skill_name).join(' · ')}</p>
          </section>
        )}
        {(h?.languages?.length > 0 || h?.gear?.length > 0) && (
          <section className="text-sm space-y-1">
            {h.languages?.length > 0 && <p><b>Languages:</b> {h.languages.join(', ')}</p>}
            {h.gear?.length > 0 && <p><b>Gear:</b> {h.gear.join(', ')}</p>}
          </section>
        )}
        {d.awards.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-1.5">Awards & press</h2>
            <ul className="text-sm space-y-0.5">{d.awards.map((a: any, i: number) => <li key={i}>{a.title}{a.org ? ` · ${a.org}` : ''}{a.year ? ` (${a.year})` : ''}</li>)}</ul>
          </section>
        )}

        <div className="pt-3 border-t text-xs text-neutral-600 space-y-0.5 break-all">
          {h?.showreel_url && <p>Showreel: {h.showreel_url}</p>}
          <p>Profile: {url}</p>
        </div>
      </div>
    </div>
  );
};

export default CrewSheet;
