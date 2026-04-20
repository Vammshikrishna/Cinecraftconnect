import { FileText, Scale, UserCheck, AlertTriangle } from 'lucide-react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

const TermsOfService = () => {
  const lastUpdated = "April 17, 2026";

  return (
    <LegalPageLayout 
      title="Terms of Service"
      subtitle="Effective Date"
      lastUpdated={lastUpdated}
      icon={<Scale className="h-7 w-7 text-primary" />}
    >
      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          1. Agreement to Terms
        </h2>
        <div className="space-y-4 text-muted-foreground leading-relaxed text-lg">
          <p>
            By accessing or using <span className="text-foreground font-semibold">CineCraft Connect</span> (the "Platform"), you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use the Platform. 
          </p>
          <p className="text-sm">
            These terms apply to all visitors, users, and others who access or use the Service.
          </p>
        </div>
      </section>

      <section className="px-6">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <UserCheck className="h-6 w-6 text-primary" />
          2. User Accounts
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          When you create an account with us, you must provide information that is accurate, complete, and current at all times.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-7 rounded-2xl bg-card border border-border/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl -translate-y-12 translate-x-12" />
            <h4 className="font-bold text-foreground text-xl mb-3 flex items-center gap-2">
              Responsibility
            </h4>
            <p className="text-muted-foreground leading-relaxed">You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.</p>
          </div>
          <div className="p-7 rounded-2xl bg-card border border-border/40 hover:border-primary/20 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-secondary/5 rounded-full blur-2xl -translate-y-12 translate-x-12" />
            <h4 className="font-bold text-foreground text-xl mb-3 flex items-center gap-2">
              Age Requirement
            </h4>
            <p className="text-muted-foreground leading-relaxed">You must be at least 18 years of age to use the Service. By using the Service, you represent and warrant that you are at least 18.</p>
          </div>
        </div>
      </section>

      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-primary" />
          3. Content & Conduct
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content").
        </p>
        <div className="grid gap-4">
          {[
            "You represent and warrant that you own the Content or have the right to use it.",
            "Your Content must not violate the privacy rights, publicity rights, or copyrights of any person.",
            "We reserve the right to remove any content that we deem inappropriate or in violation of these terms."
          ].map((text, i) => (
            <div key={i} className="flex gap-4 items-center p-4 rounded-xl bg-background/50 border border-border/20">
              <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
              <p className="text-sm font-medium text-foreground/90">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8 px-6">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 bg-primary rounded-full" />
            <h2 className="text-xl font-bold">4. Intellectual Property</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of CineCraft Connect and its licensors.
          </p>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-1 w-8 bg-primary rounded-full" />
            <h2 className="text-xl font-bold">5. Liability</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed italic border-l-2 border-primary/20 pl-4">
            In no event shall CineCraft Connect be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of the Service.
          </p>
        </section>
      </div>

      <section className="bg-destructive/5 border border-destructive/10 p-10 rounded-3xl">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-3 text-destructive">
          6. Termination
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
        </p>
        <p className="p-4 rounded-xl bg-background/40 border border-border/20 text-sm italic underline underline-offset-4 decoration-destructive/30">
          Upon termination, your right to use the Service will immediately cease.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default TermsOfService;
