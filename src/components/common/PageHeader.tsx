
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  Icon?: LucideIcon;
  actions?: React.ReactNode;
  onBack?: () => void;
  titleClassName?: string;
  iconClassName?: string;
  actionsAtTop?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  Icon, 
  actions,
  onBack,
  titleClassName = "text-foreground",
  iconClassName = "text-primary",
  actionsAtTop = false
}) => {
  return (
    <div className="flex flex-col gap-4 md:gap-6 mb-8 md:mb-12">
      <div className={cn(
        "flex flex-col lg:flex-row lg:items-center justify-between gap-6",
        actionsAtTop && "flex-row items-start"
      )}>
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
            <h1 className={`text-xl md:text-2xl font-black tracking-tight flex items-center gap-3 md:gap-4 ${titleClassName} leading-tight`}>
              {Icon && <Icon className={`h-5 w-5 md:h-7 md:w-7 ${iconClassName} shrink-0`} />}
              <span className="block overflow-visible">{title}</span>
            </h1>

            {subtitle && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-xs md:text-sm text-muted-foreground font-medium leading-relaxed max-w-3xl mt-0 md:mt-0.5"
              >
                {subtitle}
              </motion.div>
            )}
          </motion.div>
        </div>
        
        {actions && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
              "flex shrink-0 justify-end",
              actionsAtTop && "lg:order-last"
            )}
          >
            {actions}
          </motion.div>
        )}
      </div>
    </div>
  );
};
