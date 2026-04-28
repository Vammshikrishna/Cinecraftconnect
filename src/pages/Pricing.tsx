
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PRICING_TIERS } from '@/types/pricing';
import { Button } from '@/components/ui/button';
import { Check, X, Star, Zap, Building2, Crown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/common/PageHeader';

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const tiers = [
    PRICING_TIERS.fan,
    PRICING_TIERS.creator,
    PRICING_TIERS.studio,
  ];

  return (
    <div className="min-h-screen bg-background pb-20 pt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <PageHeader 
          title="Pricing Tiers" 
          subtitle="India Market (Launch)" 
          Icon={Crown}
        />

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center items-center gap-4 mb-12">
          <span className={cn("text-sm font-medium transition-colors", billingCycle === 'monthly' ? "text-foreground" : "text-muted-foreground")}>Monthly</span>
          <button 
            onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
            className="w-14 h-7 bg-muted/50 rounded-full relative p-1 transition-colors hover:bg-muted"
          >
            <motion.div 
              animate={{ x: billingCycle === 'monthly' ? 0 : 28 }}
              className="w-5 h-5 bg-primary rounded-full shadow-lg"
            />
          </button>
          <span className={cn("text-sm font-medium transition-colors", billingCycle === 'yearly' ? "text-foreground" : "text-muted-foreground")}>
            Yearly <span className="text-primary text-xs ml-1 font-bold">Save 30%</span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier, index) => (
            <PricingCard 
                key={tier.id} 
                tier={tier} 
                billingCycle={billingCycle} 
                index={index}
            />
          ))}
        </div>

        {/* Bottom Info */}
        <div className="mt-16 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-muted-foreground text-sm">
                <Info size={16} className="text-primary" />
                <span>Priced like Netflix India. Familiar anchor.</span>
            </div>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
                Film studios, OTT teams, and PR agencies can reach out for custom enterprise integration and API access.
            </p>
        </div>
      </div>
    </div>
  );
};

interface PricingCardProps {
  tier: any;
  billingCycle: 'monthly' | 'yearly';
  index: number;
}

const PricingCard = ({ tier, billingCycle, index }: PricingCardProps) => {
  const isCreator = tier.id === 'creator';
  const isStudio = tier.id === 'studio';
  const isFan = tier.id === 'fan';

  const price = billingCycle === 'monthly' ? tier.price.monthly : tier.price.yearly;
  const cycleText = billingCycle === 'monthly' ? '/mo' : '/yr';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "glass-card flex flex-col p-8 transition-all duration-500 hover:shadow-2xl hover:shadow-primary/5 group relative",
        isCreator && "border-primary/50 ring-1 ring-primary/20 scale-105 z-10",
        isStudio && "border-blue-500/20"
      )}
    >
      {/* Badge Tags */}
      <div className="flex justify-between items-start mb-6">
        <div className={cn(
            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
            isFan && "bg-muted/40 text-muted-foreground",
            isCreator && "bg-secondary text-primary-foreground",
            isStudio && "bg-primary/10 text-primary"
        )}>
          {isFan && "Free forever"}
          {isCreator && "Core Revenue"}
          {isStudio && "B2B Revenue"}
        </div>
        {tier.recommended && (
          <div className="bg-primary/20 text-primary text-[10px] font-black px-2 py-1 rounded-full animate-pulse">
            RECOMMENDED
          </div>
        )}
      </div>

      <h3 className="text-2xl font-black mb-2 flex items-center gap-2">
        {tier.name}
        {isCreator && <Zap className="h-5 w-5 text-primary fill-primary" />}
        {isStudio && <Building2 className="h-5 w-5 text-blue-500" />}
        {isFan && <Star className="h-5 w-5 text-amber-500" />}
      </h3>

      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black tracking-tight">₹{price.toLocaleString()}</span>
          <span className="text-muted-foreground font-medium">{cycleText}</span>
        </div>
        {billingCycle === 'monthly' && tier.price.yearly > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            ₹{(tier.price.yearly).toLocaleString()}/yr — <span className="text-primary font-bold">save 30%</span>
          </p>
        )}
        {isStudio && (
          <p className="text-xs text-muted-foreground mt-1 italic">
             For production houses & agencies
          </p>
        )}
      </div>

      <div className="h-px bg-border/20 mb-8" />

      {/* Benefits List */}
      <div className="space-y-4 mb-10 flex-grow">
        {Object.entries(tier.benefits).map(([name, benefit]: [string, any]) => (
          <div key={name} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{name}</span>
            <div className="flex items-center gap-2">
                <span className={cn(
                    "font-bold",
                    benefit.status === 'yes' && "text-primary",
                    benefit.status === 'no' && "text-muted-foreground/30",
                    benefit.status === 'limited' && "text-amber-500",
                    benefit.status === 'advanced' && "text-primary",
                    benefit.status === 'custom' && "text-blue-500"
                )}>
                  {benefit.text}
                </span>
                {benefit.status === 'yes' ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : benefit.status === 'no' ? (
                  <X className="h-4 w-4 text-muted-foreground/20" />
                ) : null}
            </div>
          </div>
        ))}
      </div>

      <Button 
        className={cn(
            "w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
            isCreator ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-[1.02]" : "variant-outline hover:bg-muted/50"
        )}
        disabled={isFan}
      >
        {isFan ? "Current Plan" : "Get Started"}
      </Button>
      
      {isFan && (
        <p className="text-[10px] text-center mt-4 text-muted-foreground leading-relaxed italic">
          Goal: acquire millions of fans.<br /> They are the product.
        </p>
      )}
    </motion.div>
  );
};

export default Pricing;

