import { Shield, Lock, Eye, FileText } from 'lucide-react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

const PrivacyPolicy = () => {
  const lastUpdated = "April 17, 2026";

  return (
    <LegalPageLayout 
      title="Privacy Policy"
      subtitle="Last updated"
      lastUpdated={lastUpdated}
      icon={<Shield className="h-7 w-7 text-primary" />}
    >
      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Eye className="h-6 w-6 text-primary" />
          1. Introduction
        </h2>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          <p>
            Welcome to CineCraft Connect. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website or use our application (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.
          </p>
          <p className="p-4 rounded-xl bg-primary/5 border border-primary/10 italic text-sm">
            CineCraft Connect is the "Data Controller" for the information you provide through our platform.
          </p>
        </div>
      </section>

      <section className="px-6">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <Lock className="h-6 w-6 text-primary" />
          2. Data We Collect
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
        </p>
        <div className="grid md:grid-cols-2 gap-5">
          {[
            { title: "Identity Data", desc: "First name, last name, username, and professional craft/role." },
            { title: "Contact Data", desc: "Email address and social media handles." },
            { title: "Technical Data", desc: "IP address, browser type, and device information." },
            { title: "Usage Data", desc: "Information about how you use our website and services." },
            { title: "Profile Data", desc: "Your portfolio, reel links, job history, and ratings." },
            { title: "Communications", desc: "Your preferences in receiving marketing and chat notifications." }
          ].map((item, i) => (
            <div key={i} className="group p-5 rounded-2xl bg-card border border-border/40 hover:border-primary/20 hover:bg-primary/5 transition-all duration-300">
              <h4 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
              <p className="text-sm text-muted-foreground/80 leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          3. How We Use Your Data
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
        </p>
        <div className="space-y-4">
          {[
            { id: "01", title: "Service Delivery", desc: "To create and manage your professional profile and production projects." },
            { id: "02", title: "Networking", desc: "To connect you with other creators, vendors, and job opportunities." },
            { id: "03", title: "Compliance", desc: "To comply with legal or regulatory obligations." }
          ].map((item, i) => (
            <div key={i} className="flex gap-5 items-start p-6 rounded-2xl bg-background/50 border border-border/30 hover:border-border transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-inner">
                <span className="text-primary text-xs font-bold tracking-widest">{item.id}</span>
              </div>
              <div>
                <h4 className="font-bold text-foreground text-lg mb-1">{item.title}</h4>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8 px-6">
        <section>
          <h2 className="text-xl font-bold mb-4">4. Data Retention</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We will only retain your personal data for as long as reasonably necessary to fulfil the purposes we collected it for, including for the purposes of satisfying any legal, regulatory, tax, accounting or reporting requirements.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">5. Your Legal Rights</h2>
          <ul className="space-y-2 text-muted-foreground text-sm list-none p-0">
            {[
              "Request access to your personal data",
              "Request correction of your personal data",
              "Request erasure of your personal data",
              "Object to processing of your personal data",
              "Request restriction of processing",
              "Right to withdraw consent"
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                {text}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="bg-primary/5 border border-primary/10 p-8 md:p-10 rounded-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
          <Shield className="h-24 w-24 text-primary" />
        </div>
        <div className="relative z-10">
          <h4 className="text-primary font-bold text-xl mb-4 flex items-center gap-2">
            Notice for App Users
          </h4>
          <p className="text-muted-foreground leading-relaxed max-w-2xl">
            Apple and Google require us to provide a simple way to delete your account. You can do this at any time through the <strong>Account Settings</strong> section of our application. All your personal identity data will be purged upon account deletion.
          </p>
        </div>
      </section>

      <section className="pt-12 border-t border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">6. Contact Us</h2>
          <p className="text-muted-foreground leading-relaxed">
            If you have any questions about this privacy policy or our privacy practices.
          </p>
        </div>
        <div className="p-4 px-8 rounded-full bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:scale-105 transition-transform cursor-pointer">
          support@cinecraftconnect.com
        </div>
      </section>
    </LegalPageLayout>
  );
};

export default PrivacyPolicy;

