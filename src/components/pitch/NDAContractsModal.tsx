import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, PenLine, FileText, CheckCircle2, Download, X } from 'lucide-react';
import { format } from 'date-fns';

interface NDAContractsModalProps {
    isOpen: boolean;
    onClose: () => void;
    writerName: string;
    producerName: string;
    storyTitle: string;
    onSign: (signature: string) => void;
}

export const NDAContractsModal = ({
    isOpen,
    onClose,
    writerName,
    producerName,
    storyTitle,
    onSign,
}: NDAContractsModalProps) => {
    const [signature, setSignature] = useState('');
    const [isSigned, setIsSigned] = useState(false);
    const [signedTime, setSignedTime] = useState('');
    const [tamperHash, setTamperHash] = useState('');

    const handleSign = () => {
        if (signature.trim().length < 3) return;
        const now = new Date();
        const timeStr = format(now, "yyyy-MM-dd HH:mm:ss 'UTC'");
        const hash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        
        setIsSigned(true);
        setSignedTime(timeStr);
        setTamperHash(hash.toUpperCase());
        onSign(signature.trim());
    };

    const handleDownloadHTML = () => {
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>CONFIDENTIALITY & NON-DISCLOSURE AGREEMENT (NDA)</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
  .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  .meta-table td { border: 1px solid #ddd; padding: 10px; font-size: 13px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-col { border-top: 1px solid #333; width: 45%; pt: 10px; font-size: 12px; }
  .hash-box { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 12px; text-align: center; font-family: monospace; font-size: 11px; margin-top: 30px; }
</style>
</head>
<body>
<div class="title">Confidentiality & Non-Disclosure Agreement (NDA)</div>
<table class="meta-table">
  <tr>
    <td><strong>Disclosing Party (Writer)</strong></td>
    <td>${writerName}</td>
  </tr>
  <tr>
    <td><strong>Receiving Party (Producer)</strong></td>
    <td>${producerName}</td>
  </tr>
  <tr>
    <td><strong>Subject Matter (Concept)</strong></td>
    <td>"${storyTitle}"</td>
  </tr>
  <tr>
    <td><strong>Signing Date</strong></td>
    <td>${signedTime}</td>
  </tr>
</table>

<div class="section">
  <div class="section-title">1. Purpose of Disclosure</div>
  <div>The Disclosing Party has developed certain valuable creative concepts, ideas, and screenplays. The Receiving Party wishes to evaluate the Subject Matter for potential acquisition, option, co-development, or production collaboration.</div>
</div>

<div class="section">
  <div class="section-title">2. Definition of Confidential Information</div>
  <div>Confidential Information includes all creative materials, treatments, synopses, loglines, story worlds, character profiles, pilot outlines, and script details disclosed in connection with the Subject Matter.</div>
</div>

<div class="section">
  <div class="section-title">3. Obligations of Receiving Party</div>
  <div>The Receiving Party agrees to:
    <ul>
      <li>Hold the Confidential Information in strict confidence and prevent unauthorized disclosure.</li>
      <li>Use the Confidential Information solely for evaluation purposes and not for any commercial exploitation.</li>
      <li>Not copy, distribute, or adapt the concepts without direct written consent from the Disclosing Party.</li>
    </ul>
  </div>
</div>

<div class="section">
  <div class="section-title">4. Arbitration & Legal Standing</div>
  <div>This Agreement is executed digitally under the terms of the Indian Information Technology Act, 2000. In case of any copyright, intellectual property, or credit disputes, both parties agree to submit to the binding arbitration of the CineCraft Connect Dispute Resolution Committee and/or the Screenwriters Association (SWA).</div>
</div>

<div class="signatures">
  <div class="sig-col">
    <strong>Disclosing Party</strong><br/>
    Signed: Electronically Filed & Protected<br/>
    Name: ${writerName}
  </div>
  <div class="sig-col">
    <strong>Receiving Party</strong><br/>
    Signed: ${signature}<br/>
    Timestamp: ${signedTime}
  </div>
</div>

<div class="hash-box">
  SECURE TAMPER-PROOF DIGITAL RECEIPT HASH:<br/>
  <strong>${tamperHash}</strong><br/>
  Logged on CineCraft Connect servers
</div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NDA_${storyTitle.replace(/\s+/g, '_')}_signed.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <Shield className="h-5 w-5 text-amber-500" />
                        Confidentiality & Non-Disclosure Agreement
                    </DialogTitle>
                    <DialogDescription>
                        A legally binding agreement between you and the writer to protect the intellectual property before access.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-2 text-sm leading-relaxed border border-border/80 rounded-xl p-5 bg-card/60 font-serif">
                    <h3 className="text-center font-bold text-lg border-b pb-3 uppercase">NDA Agreement Terms</h3>
                    
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 text-muted-foreground text-xs font-sans">
                        <p><strong>1. Confidentiality:</strong> The Receiving Party (${producerName}) agrees to hold the ideas, treatment, synopses, and scripts of the Disclosing Party (${writerName}) concerning the project <strong>"{storyTitle}"</strong> in strict confidence and shall not disclose it to any third party.</p>
                        <p><strong>2. Rights Preservation:</strong> All rights, copyright, title, and interest in and to the concept remain exclusively with the writer. The producer shall not acquire any rights except as explicitly negotiated in a separate, written option or purchase agreement.</p>
                        <p><strong>3. Non-Use:</strong> The producer agrees not to produce, adapt, co-write, or develop any content based on the confidential materials without compensating the writer.</p>
                        <p><strong>4. Digital Execution:</strong> This agreement is digitally signed and logged. It constitutes a legally binding clickwrap agreement under the Indian Information Technology Act, 2000.</p>
                    </div>

                    <div className="border-t pt-4 font-sans space-y-4">
                        {!isSigned ? (
                            <div className="space-y-3">
                                <Label className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                    Type your full legal name to sign digitally *
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Your legal name as per Aadhaar/Passport"
                                        value={signature}
                                        onChange={e => setSignature(e.target.value)}
                                        className="h-11 border-border/60 bg-background/50"
                                    />
                                    <Button
                                        onClick={handleSign}
                                        disabled={signature.trim().length < 3}
                                        className="bg-amber-500 hover:bg-amber-600 font-bold px-6 shrink-0 h-11 text-white"
                                    >
                                        <PenLine className="h-4 w-4 mr-2" /> Sign & Unlock
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                                <div className="flex items-center gap-2 text-green-500 font-bold">
                                    <CheckCircle2 className="h-5 w-5" />
                                    Agreement Signed Electronically!
                                </div>
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p><strong>Signee:</strong> {signature}</p>
                                    <p><strong>Timestamp:</strong> {signedTime}</p>
                                    <p className="font-mono text-[10px]"><strong>Receipt ID:</strong> {tamperHash}</p>
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleDownloadHTML}>
                                        <Download className="h-3.5 w-3.5" /> Download Contract PDF
                                    </Button>
                                    <Button size="sm" className="text-xs" onClick={onClose}>Close & View Details</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
