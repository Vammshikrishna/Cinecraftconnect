import { BookOpen, HelpCircle, Code, Rocket, Users, ShieldCheck } from 'lucide-react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

const Documentation = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <LegalPageLayout 
      title="Documentation"
      subtitle="Comprehensive Guide"
      lastUpdated={lastUpdated}
      icon={<BookOpen className="h-7 w-7 text-primary" />}
    >
      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Rocket className="h-6 w-6 text-primary" />
          Getting Started
        </h2>
        <p className="text-muted-foreground leading-relaxed text-lg">
          CineCraft Connect is designed to simplify every aspect of film production. Whether you are a creator looking for talent or a vendor offering equipment, our tools are built for your workflow.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Creator Network
            </h3>
            <p className="text-sm text-muted-foreground">Build your professional portfolio, connect with peers, and showcase your filmography to the industry.</p>
          </div>
          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <Code className="w-4 h-4 text-primary" />
              Project Spaces
            </h3>
            <p className="text-sm text-muted-foreground">Collaborate in real-time with your crew. Manage scripts, boards, and schedules in one unified workspace.</p>
          </div>
        </div>
      </section>

      <section className="space-y-6 px-4">
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <HelpCircle className="h-7 w-7 text-primary" />
          Feature Overviews
        </h2>
        
        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-bold mb-3">1. Professional Portfolios</h3>
            <p className="text-muted-foreground">Your profile is your digital resume. High-fidelity video embeds, credit lists, and gear lists allow you to stand out to call creators and recruiters.</p>
          </div>
          
          <div>
            <h3 className="text-xl font-bold mb-3">2. Marketplace & Vendors</h3>
            <p className="text-muted-foreground">Rent high-end equipment or secure film locations through our verified marketplace. Vendors can manage inventory and bookings seamlessly.</p>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-3">3. Discussion Rooms</h3>
            <p className="text-muted-foreground">Join craft-specific communities. From Cinematography to Post-Production, engage in deep industry discussions with verified professionals.</p>
          </div>
        </div>
      </section>

      <section className="p-8 rounded-3xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Need Technical Help?
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          If you encounter any bugs or need technical guidance, our engineering team is available 24/7 through the Support Hub.
        </p>
        <p className="text-xs font-bold text-primary uppercase tracking-[0.1em]">
          Contact: support@cinecraft.connect
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default Documentation;
