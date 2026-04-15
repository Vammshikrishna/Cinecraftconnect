
import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  Icon?: LucideIcon;
  actions?: React.ReactNode;
  titleClassName?: string;
  iconClassName?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  subtitle, 
  Icon, 
  actions,
  titleClassName = "text-foreground",
  iconClassName = "text-primary"
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl"
      >
        <h1 className={`text-2xl md:text-3xl font-bold tracking-tight mb-1 flex items-center gap-2 leading-none ${titleClassName}`}>
          {Icon && <Icon className={`h-6 w-6 md:h-8 md:w-8 ${iconClassName}`} />}
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm md:text-base text-muted-foreground font-medium leading-relaxed">
            {subtitle}
          </p>
        )}
      </motion.div>
      
      {actions && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap gap-3 w-full md:w-auto shrink-0"
        >
          {actions}
        </motion.div>
      )}
    </div>
  );
};
