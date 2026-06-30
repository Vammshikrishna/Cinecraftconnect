import React, { useState, useEffect } from 'react';
import { useE2EEBackup } from '@/contexts/E2EEBackupContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Shield, Lock, AlertTriangle, KeyRound, ArrowRight, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const E2EEKeyBackupModal: React.FC = () => {
  const { 
    isChecking, 
    isSetupRequired, 
    isRecoveryRequired, 
    setupBackup, 
    recoverBackup, 
    performReset 
  } = useE2EEBackup();

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Forgot PIN reset confirmation state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Reset inputs when state changes
  useEffect(() => {
    setPin('');
    setConfirmPin('');
    setSetupStep('enter');
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowResetConfirm(false);
    setResetConfirmText('');
  }, [isSetupRequired, isRecoveryRequired]);

  // Handle Setup Pin Submit
  const handleSetupSubmit = async () => {
    if (pin !== confirmPin) {
      setErrorMsg("PINs do not match. Please try again.");
      setConfirmPin('');
      setSetupStep('enter');
      setPin('');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await setupBackup(pin);
    } catch (err) {
      setErrorMsg("Failed to save backup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Recovery Submit
  const handleRecoverySubmit = async (recoveryPin: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    const success = await recoverBackup(recoveryPin);
    setIsSubmitting(false);
    if (!success) {
      setErrorMsg("Incorrect PIN. Please try again.");
      setPin('');
    }
  };

  // Handle identity reset
  const handleResetSubmit = async () => {
    if (resetConfirmText !== 'RESET') {
      setErrorMsg("Please type 'RESET' to confirm.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await performReset();
    } catch (err) {
      setErrorMsg("Failed to reset identity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-advance setup or auto-submit recovery on complete input
  useEffect(() => {
    if (isSetupRequired) {
      if (setupStep === 'enter' && pin.length === 6) {
        // Clear errors and move to confirm step
        setErrorMsg(null);
        setSetupStep('confirm');
      } else if (setupStep === 'confirm' && confirmPin.length === 6) {
        if (pin === confirmPin) {
          setErrorMsg(null);
          setSuccessMsg("PINs match! Ready to save.");
        } else {
          setErrorMsg("PINs do not match. Restarting...");
          const timer = setTimeout(() => {
            setPin('');
            setConfirmPin('');
            setSetupStep('enter');
            setErrorMsg(null);
          }, 1500);
          return () => clearTimeout(timer);
        }
      }
    } else if (isRecoveryRequired) {
      if (pin.length === 6) {
        handleRecoverySubmit(pin);
      }
    }
  }, [pin, confirmPin, setupStep, isSetupRequired, isRecoveryRequired]);

  // If loading E2EE backup state, show nothing
  if (isChecking) return null;

  // The modal should only display if setup or recovery is required
  const isOpen = isSetupRequired || isRecoveryRequired;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}} modal>
      <DialogContent hideClose className="max-w-md border border-border/40 bg-background/95 shadow-2xl backdrop-blur-lg sm:rounded-2xl z-[999] overflow-hidden">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            {isSetupRequired ? (
              <Shield className="h-6 w-6 animate-pulse" />
            ) : (
              <Lock className="h-6 w-6" />
            )}
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isSetupRequired ? "Secure E2EE Chat Backup" : "Restore Encrypted Chats"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-sm mt-1">
            {isSetupRequired 
              ? "Create a recovery PIN to back up your secure conversations. This allows you to restore your chats on other devices."
              : "This device is not yet verified. Please enter your 6-digit recovery PIN to restore your end-to-end encrypted chats."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <AnimatePresence mode="wait">
            {!showResetConfirm ? (
              <motion.div 
                key="pin-entry"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex flex-col items-center space-y-4"
              >
                {isSetupRequired && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {setupStep === 'enter' ? "Step 1: Choose PIN" : "Step 2: Confirm PIN"}
                  </span>
                )}

                <InputOTP
                  maxLength={6}
                  value={setupStep === 'enter' ? pin : confirmPin}
                  onChange={setupStep === 'enter' ? setPin : setConfirmPin}
                  disabled={isSubmitting}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-12 text-lg" />
                    <InputOTPSlot index={1} className="w-12 h-12 text-lg" />
                    <InputOTPSlot index={2} className="w-12 h-12 text-lg" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="w-12 h-12 text-lg" />
                    <InputOTPSlot index={4} className="w-12 h-12 text-lg" />
                    <InputOTPSlot index={5} className="w-12 h-12 text-lg" />
                  </InputOTPGroup>
                </InputOTP>

                {errorMsg && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium animate-bounce mt-1">
                    <XCircle className="h-4 w-4" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="flex items-center gap-1.5 text-xs text-success font-medium mt-1">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{successMsg}</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="reset-confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full flex flex-col items-center space-y-4 px-2"
              >
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-muted-foreground flex flex-col gap-2 leading-relaxed">
                  <div className="flex items-center gap-2 text-destructive font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>CRITICAL WARNING</span>
                  </div>
                  <p>
                    Resetting E2EE will **permanently delete** your recovery backup and active keys. You will lose access to all past encrypted chats (they will permanently display as **"unable to show this message"**).
                  </p>
                  <p>
                    New conversations will be encrypted and backed up under your new PIN. Other group members will automatically re-encrypt new group keys for you when they are online.
                  </p>
                </div>

                <div className="w-full flex flex-col space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Type <span className="text-destructive font-bold">RESET</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    disabled={isSubmitting}
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-destructive focus:ring-1 focus:ring-destructive uppercase"
                  />
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive font-medium mt-1">
                    <XCircle className="h-4 w-4" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row w-full gap-2 sm:gap-0 border-t border-border/20 pt-4 mt-2">
          {!showResetConfirm ? (
            <>
              {isSetupRequired ? (
                <Button
                  onClick={handleSetupSubmit}
                  disabled={isSubmitting || setupStep === 'enter' || pin !== confirmPin}
                  className="w-full sm:w-auto font-medium"
                >
                  {isSubmitting ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Save & Secure Chat
                </Button>
              ) : (
                <div className="flex flex-col sm:flex-row w-full justify-between items-center gap-4">
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors underline"
                    disabled={isSubmitting}
                  >
                    Forgot PIN? Reset Backup
                  </button>
                  <Button
                    onClick={() => handleRecoverySubmit(pin)}
                    disabled={isSubmitting || pin.length !== 6}
                    className="w-full sm:w-auto font-medium"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="mr-2 h-4 w-4" />
                    )}
                    Restore Chats
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="flex w-full justify-between items-center gap-4">
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                  setErrorMsg(null);
                }}
                className="text-xs font-semibold hover:underline"
                disabled={isSubmitting}
              >
                Back to Recovery
              </button>
              <Button
                variant="destructive"
                onClick={handleResetSubmit}
                disabled={isSubmitting || resetConfirmText !== 'RESET'}
                className="w-full sm:w-auto font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isSubmitting ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                Reset & Start Fresh
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
