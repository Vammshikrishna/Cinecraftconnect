import { Users, Scale, Heart, AlertTriangle, CheckCircle2 } from 'lucide-react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

const CommunityGuidelines = () => {
  const lastUpdated = "April 29, 2026";

  return (
    <LegalPageLayout 
      title="Community Guidelines"
      subtitle="Code of Conduct"
      lastUpdated={lastUpdated}
      icon={<Users className="h-7 w-7 text-primary" />}
    >
      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Heart className="h-6 w-6 text-primary" />
          Our Philosophy
        </h2>
        <p className="text-muted-foreground leading-relaxed text-lg">
          CineCraft Connect is a professional community of filmmakers, artists, and technicians. We believe in fostering an environment built on mutual respect, creative freedom, and professional integrity.
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            Professional Conduct
          </h2>
          <ul className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <li>• Be respectful in Discussion Rooms and private messages.</li>
            <li>• Honor your commitments on projects and marketplaces.</li>
            <li>• Provide honest feedback and constructive criticism.</li>
            <li>• Represent your credits and gear inventory accurately.</li>
          </ul>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Zero Tolerance
          </h2>
          <ul className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <li>• Harassment, hate speech, or bullying of any kind.</li>
            <li>• Posting pirated content or unauthorized scripts.</li>
            <li>• Fraudulent marketplace listings or payment scams.</li>
            <li>• Impersonating other creators or staff members.</li>
          </ul>
        </section>
      </div>

      <section className="p-10 rounded-3xl border border-border/50 bg-muted/20">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Scale className="h-6 w-6 text-primary" />
          Enforcement & Governance
        </h2>
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <p>
            Violations of these guidelines are taken seriously. Our Moderation Team uses a multi-tier enforcement system:
          </p>
          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="font-bold text-foreground">1. Warnings:</span>
              <span>Initial notification for minor first-time violations.</span>
            </div>
            <div className="flex gap-4">
              <span className="font-bold text-foreground">2. Muting:</span>
              <span>Temporary restriction of messaging and discussion privileges.</span>
            </div>
            <div className="flex gap-4">
              <span className="font-bold text-foreground">3. Suspension:</span>
              <span>Full account restriction for severe or repeat offenses.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          See something that violates these rules? Use the <strong>"Report"</strong> button found on all content and profiles.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default CommunityGuidelines;
