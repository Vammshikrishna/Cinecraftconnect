
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  Icon?: LucideIcon;
  actions?: React.ReactNode;
  onBack?: () => void;
  titleClassName?: string;
  iconClassName?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  Icon, 
  actions,
  onBack,
  titleClassName = "text-foreground",
  iconClassName = "text-primary"
}) => {
  return (
    <div className="flex flex-col gap-1.5 mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {onBack && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all shadow-sm mt-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </motion.button>
          )}

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-w-0 flex flex-col"
          >
            <h1 className={`text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2.5 ${titleClassName} leading-tight`}>
              {Icon && <Icon className={`h-6 w-6 md:h-8 md:w-8 ${iconClassName} shrink-0`} />}
              <span className="truncate">{title}</span>
            </h1>

            {subtitle && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-sm md:text-base text-muted-foreground font-medium leading-relaxed max-w-2xl mt-1"
              >
                {subtitle}
              </motion.p>
            )}
          </motion.div>
        </div>
        
        {actions && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex shrink-0"
          >
            {actions}
          </motion.div>
        )}
      </div>
    </div>
  );
};
