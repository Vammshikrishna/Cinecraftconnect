import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  onSubmitted: () => void;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** A vendor sends a business document (registration, GST, licence…). An admin reviews it; only that sets the badge. */
export const VendorVerificationDialog = ({ open, onOpenChange, vendorId, vendorName, onSubmitted }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [registration, setRegistration] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setRegistration('');
      setWebsite('');
      setNotes('');
    }
  }, [open]);

  const pick = (f: File | null) => {
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return toast({ title: 'Unsupported file', description: 'Use a PDF, JPG, PNG or WebP.', variant: 'destructive' });
    if (f.size > MAX_BYTES) return toast({ title: 'File too large', description: 'Please attach a file up to 10 MB.', variant: 'destructive' });
    setFile(f);
  };

  const submit = async () => {
    if (!user || !file) return toast({ title: 'Attach a document', description: 'A registration certificate, licence or tax document.', variant: 'destructive' });
    setBusy(true);
    try {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('vendor_docs').upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data, error } = await (supabase as any).rpc('submit_vendor_verification', {
        p_vendor_id: vendorId,
        p_document_ref: `vendor_docs:${path}`,
        p_registration: registration.trim() || null,
        p_website: website.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      toast({ title: 'Sent for review', description: "We'll notify you when your business is reviewed." });
      onOpenChange(false);
      onSubmitted();
    } catch (e: any) {
      toast({ title: 'Could not submit', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BadgeCheck className="w-5 h-5" /> Get verified</DialogTitle>
          <DialogDescription>{vendorName}. Your document is private: only you and our review team can open it.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 cursor-pointer hover:bg-muted/30">
            <Upload className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold flex-1 truncate">{file ? file.name : 'Attach a business document (PDF or image, up to 10 MB)'}</span>
            <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
          </label>
          <div className="space-y-1.5"><Label className="text-xs">Registration / GST number (optional)</Label><Input maxLength={80} value={registration} onChange={(e) => setRegistration(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Website (optional)</Label><Input maxLength={200} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Anything we should know? (optional)</Label><Textarea className="min-h-[70px]" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button className="w-full h-12 rounded-xl font-bold" onClick={submit} disabled={busy || !file}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit for review'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
