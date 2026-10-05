import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PageLoader = () => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const location = useLocation();

  useEffect(() => {
    // Start progress when location changes
    setVisible(true);
    setProgress(30);

    const timer = setTimeout(() => {
      setProgress(90);
    }, 400);

    const finishTimer = setTimeout(() => {
      setVisible(false);
      setProgress(100);
    }, 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]">
      <div 
        className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary),0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default PageLoader;
