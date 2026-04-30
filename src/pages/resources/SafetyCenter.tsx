import { ShieldCheck, Lock, EyeOff, UserCheck, Smartphone, ShieldAlert } from 'lucide-react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

const SafetyCenter = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <LegalPageLayout 
      title="Safety Center"
      subtitle="Security & Trust"
      lastUpdated={lastUpdated}
      icon={<ShieldCheck className="h-7 w-7 text-primary" />}
    >
      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5 text-center">
        <h2 className="text-3xl font-bold mb-4">Your Safety is Our Priority</h2>
        <p className="text-muted-foreground leading-relaxed text-lg max-w-2xl mx-auto">
          CineCraft Connect employs enterprise-grade security protocols to ensure your data, projects, and transactions remain protected.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Lock, title: 'Data Encryption', desc: 'All personal data and private project files are encrypted at rest and in transit.' },
          { icon: EyeOff, title: 'Privacy Controls', desc: 'Granular controls allow you to choose who sees your portfolio, credits, and contact info.' },
          { icon: UserCheck, title: 'Verified Profiles', desc: 'Look for the checkmark to identify verified professionals and equipment vendors.' }
        ].map((item) => (
          <div key={item.title} className="p-6 rounded-3xl border border-border/50 bg-card/50">
            <item.icon className="w-8 h-8 text-primary mb-4" />
            <h3 className="font-bold mb-2">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <section className="space-y-8 mt-12">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-primary" />
          Securing Your Account
        </h2>
        
        <div className="space-y-6">
          <div className="flex gap-6 p-6 rounded-2xl bg-muted/30 border border-border/50">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">1</span>
            </div>
            <div>
              <h3 className="font-bold mb-1">Use a Strong Password</h3>
              <p className="text-sm text-muted-foreground">Always use a unique password for CineCraft. We recommend using a password manager to generate and store complex credentials.</p>
            </div>
          </div>

          <div className="flex gap-6 p-6 rounded-2xl bg-muted/30 border border-border/50">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">2</span>
            </div>
            <div>
              <h3 className="font-bold mb-1">Verify Marketplace Listings</h3>
              <p className="text-sm text-muted-foreground">Before renting equipment, check the vendor's ratings and verification status. Use our internal messaging for all project coordination.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="p-10 rounded-3xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 mt-12">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-red-500">
          <ShieldAlert className="h-6 w-6" />
          Reporting Suspicious Activity
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          If you believe your account has been compromised or you encounter fraudulent activity, contact our Security Operations Center (SOC) immediately. 
        </p>
        <div className="p-4 rounded-xl bg-red-500/5 text-red-500 font-bold text-sm tracking-widest uppercase">
          Emergency: security@cinecraft.connect
        </div>
      </section>
    </LegalPageLayout>
  );
};

export default SafetyCenter;
