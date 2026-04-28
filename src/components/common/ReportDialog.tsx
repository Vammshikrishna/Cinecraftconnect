import { useState } from 'react';
import { Flag, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'hate_speech', label: 'Hate Speech' },
  { id: 'misinformation', label: 'Misinformation' },
  { id: 'explicit_content', label: 'Explicit Content' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'fraud', label: 'Fraud / Scam' },
  { id: 'other', label: 'Other' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetType: 'post' | 'comment' | 'user' | 'job' | 'listing' | 'room' | 'message';
}

const ReportDialog = ({ open, onOpenChange, targetId, targetType }: ReportDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to report content.", variant: "destructive" });
      return;
    }

    if (!reason) {
      toast({ title: "Reason Required", description: "Please select a reason for reporting.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('content_reports')
        .insert({
          reported_by: user.id,
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.trim() || null,
          status: 'pending'
        });

      if (error) throw error;

      setSuccess(true);
      toast({ title: "Report Submitted", description: "Thank you for helping keep our community safe. Moderators will review this shortly." });
      
      // Auto close after 2 seconds on success
      setTimeout(() => {
        onOpenChange(false);
        // Reset state for next time
        setTimeout(() => {
          setSuccess(false);
          setReason('');
          setDetails('');
        }, 300);
      }, 2000);
    } catch (err: any) {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] glass-card border border-white/10 rounded-[32px] overflow-hidden p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Flag className="w-5 h-5 text-rose-500" />
            Report Content
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs uppercase tracking-widest font-black mt-2">
            Layer 5 — Community Safety
          </DialogDescription>
        </DialogHeader>

        {!success ? (
          <div className="p-6 pt-4 space-y-4">
            <div>
              <p className="text-sm font-bold text-foreground mb-3">Why are you reporting this {targetType}?</p>
              <div className="grid grid-cols-2 gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      reason === r.id
                        ? 'bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:border-white/10'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-foreground mb-2">Additional Details (optional)</p>
              <Textarea
                placeholder="Tell us more about the issue..."
                className="bg-background/50 border-white/10 rounded-2xl resize-none min-h-[80px] focus:ring-rose-500/30"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl flex gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 leading-tight">
                <strong>Note:</strong> Abusing the reporting system or submitting false reports may result in account suspension.
              </p>
            </div>

            <DialogFooter className="flex-row gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !reason}
                className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20"
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Submit Report"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto border border-green-500/20">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Report Submitted</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Thank you for your report. Our moderation team will investigate this content according to CineCraft community standards.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
