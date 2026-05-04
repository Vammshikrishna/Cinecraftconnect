import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Flag, 
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

export type ReportTargetType = 'project' | 'discussion' | 'post' | 'profile' | 'comment';

interface ReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle: string;
}

const REASONS = [
  { id: 'spam', label: 'Spam or Misleading', description: 'Repeated content or deceptive advertising' },
  { id: 'harassment', label: 'Harassment', description: 'Attacking or bullying specific individuals' },
  { id: 'inappropriate', label: 'Inappropriate Content', description: 'Adult content or graphic violence' },
  { id: 'hate_speech', label: 'Hate Speech', description: 'Attacking protected groups or inciting violence' },
  { id: 'intellectual_property', label: 'Copyright Violation', description: 'Using assets without permission' },
  { id: 'security', label: 'Security Risk', description: 'Malicious links or phishing attempts' },
  { id: 'other', label: 'Other', description: 'Anything else that violates our terms' }
];

export const ReportDialog = ({
  isOpen,
  onOpenChange,
  targetType,
  targetId,
  targetTitle
}: ReportDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Reason Required", description: "Please select a reason for this report.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from('content_reports')
        .insert({
          reporter_id: user?.id,
          target_type: targetType,
          target_id: targetId,
          target_title: targetTitle,
          reason,
          details,
          priority: (reason === 'security' || reason === 'hate_speech') ? 'high' : 'medium'
        });

      if (error) throw error;

      setIsSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        // Reset after modal closes
        setTimeout(() => {
          setIsSuccess(false);
          setReason('');
          setDetails('');
        }, 300);
      }, 2000);

    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <Flag className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Report Content</DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Target: {targetType} • {targetTitle.slice(0, 30)}{targetTitle.length > 30 ? '...' : ''}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    What is the primary issue?
                  </Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="rounded-xl h-12 bg-muted/30 border-border/50">
                      <SelectValue placeholder="Select a reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem key={r.id} value={r.id} className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-sm">{r.label}</span>
                            <span className="text-[10px] text-muted-foreground leading-none">{r.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Additional Details (Optional)
                  </Label>
                  <Textarea
                    id="details"
                    placeholder="Provide more context for the moderation team..."
                    className="rounded-xl min-h-[100px] resize-none bg-muted/30 border-border/50"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </div>

                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex gap-3">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-amber-200/70 font-medium">
                    Misuse of the reporting system may lead to account restrictions. Only flag content that clearly violates our community guidelines.
                  </p>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button 
                  variant="ghost" 
                  onClick={() => onOpenChange(false)}
                  className="rounded-xl font-bold uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !reason}
                  className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] px-8 shadow-lg shadow-red-600/20"
                >
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                  {!isSubmitting && <ChevronRight className="w-3 h-3 ml-2" />}
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 flex flex-col items-center text-center space-y-6"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tight">Report Received</h3>
                <p className="text-sm text-muted-foreground font-medium max-w-[280px]">
                  Thank you for keeping CineCraft safe. Our moderation team has been notified.
                </p>
              </div>
              <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2 }}
                  className="h-full bg-green-500"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
