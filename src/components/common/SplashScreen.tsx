import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen as CapSplashScreen } from '@capacitor/splash-screen';

interface SplashScreenProps {
  isVisible: boolean;
  onAnimationComplete?: () => void;
}

/**
 * Premium Rotating Splash Screen for Native Mobile/Tablet
 * Provides a cinematic startup experience with a rotating logo and smooth transitions.
 */
const SplashScreen = ({ isVisible, onAnimationComplete }: SplashScreenProps) => {
  useEffect(() => {
    if (isVisible) {
      
      // Hide the native capacitor splash screen once our JS splash is ready
      if (Capacitor.isNativePlatform()) {
        CapSplashScreen.hide({
          fadeOutDuration: 400
        }).catch(err => console.warn('Native splash hide failed:', err));
      }
    }
  }, [isVisible]);

  return (
    <AnimatePresence onExitComplete={onAnimationComplete}>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0B0B0B] touch-none select-none"
        >
          {/* Cinematic Ambient Glow */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255, 75, 51, 0.15) 0%, transparent 70%)',
              filter: 'blur(60px)'
            }}
          />

          {/* Logo Container with Breathing & Rotation */}
          <div className="relative flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ 
                scale: [1, 1.05, 1],
                opacity: 1,
              }}
              transition={{ 
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 1.5 }
              }}
              className="relative z-10"
            >
              <motion.img 
                src="/logo.png" 
                alt="CineCraft Connect" 
                animate={{ 
                  rotate: [0, 360],
                }}
                transition={{ 
                  rotate: { 
                    duration: 12, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }
                }}
                className="w-28 h-28 sm:w-36 sm:h-36 object-contain rounded-full shadow-[0_0_50px_rgba(255,75,51,0.25)]"
                style={{ willChange: 'transform' }}
              />
            </motion.div>

            {/* Brand Identity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1, ease: "easeOut" }}
              className="mt-10 flex flex-col items-center gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-white text-2xl font-black tracking-tighter">CineCraft</span>
                <span className="text-primary text-2xl font-black tracking-tighter">Connect</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
