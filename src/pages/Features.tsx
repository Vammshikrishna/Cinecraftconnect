import { motion } from "framer-motion";
import { 
  ShoppingBag, 
  Briefcase, 
  Zap, 
  Globe, 
  Lock, 
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Home,
  Users,
  Crown,
  Film
} from "lucide-react";
import DiscussionRoomIcon from "@/components/icons/DiscussionRoomIcon";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";

const Features = () => {
  const { user } = useAuth();

  const features = [
    {
      id: "feed",
      title: "Community Feed",
      description: "Your personalized stream of industry updates, behind-the-scenes content, and creative inspiration from the professionals you follow.",
      icon: Home,
      color: "bg-rose-500/10 text-rose-500",
      image: "/assets/features/feed.png",
      details: ["Photo & Video Posts", "Industry News", "Behind The Scenes", "Creator Spotlights"]
    },
    {
      id: "network",
      title: "Creator Network",
      description: "Discover and connect with talented professionals across every craft. Build your dream crew and expand your creative circle.",
      icon: Users,
      color: "bg-sky-500/10 text-sky-500",
      image: "/assets/features/network.png",
      details: ["Smart Matching", "Craft Filters", "Mutual Connections", "Portfolio Previews"]
    },
    {
      id: "projects",
      title: "Project Management",
      description: "Organize your production from script to screen. Track scenes, manage assets, and collaborate with your crew in real-time.",
      icon: Film,
      color: "bg-blue-500/10 text-blue-500",
      image: "/assets/features/projects.png",
      details: ["Scene Tracking", "Asset Library", "Crew Roles", "Production Timeline"]
    },
    {
      id: "marketplace",
      title: "Equipment Marketplace",
      description: "Rent professional cinema gear from verified creators. From ARRI Alexas to anamorphic lenses, find what you need for your next shoot.",
      icon: ShoppingBag,
      color: "bg-orange-500/10 text-orange-500",
      image: "/assets/features/marketplace.png",
      details: ["Verified Listings", "Secure Payments", "Insurance Options", "Local Pickups"]
    },
    {
      id: "jobs",
      title: "CineCraft Job Board",
      description: "The most active job board for the film industry. Find roles in camera, sound, lighting, post-production, and more.",
      icon: Briefcase,
      color: "bg-green-500/10 text-green-500",
      image: "/assets/features/jobs.png",
      details: ["Tailored Roles", "Portfolio Integration", "Direct Messaging", "Verified Employers"]
    },
    {
      id: "discussions",
      title: "Discussion Rooms",
      description: "Real-time collaboration spaces for creative synergy. Join voice calls, share screens, and brainstorm with your team.",
      icon: DiscussionRoomIcon,
      color: "bg-purple-500/10 text-purple-500",
      image: "/assets/features/discussions.png",
      details: ["Spatial Audio", "Screen Sharing", "Whiteboarding", "Room Categories"]
    }
  ];

  const secondaryFeatures = [
    { title: "Global Network", icon: Globe, desc: "Connect with professionals worldwide." },
    { title: "Secure Workflow", icon: Lock, desc: "Your data and assets are encrypted." },
    { title: "Instant Updates", icon: Zap, desc: "Real-time sync across all devices." },
    { title: "Pro Verification", icon: CheckCircle2, desc: "Build trust with verified badges." }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      <main className="pt-32">
        {/* Hero Section */}
        <section className="px-6 mb-32 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="max-w-7xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8">
                Everything you need to <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-orange-500 to-red-500">
                  Create Masterpieces.
                </span>
              </h1>
              <p className="text-muted-foreground text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
                CineCraft Connect is the all-in-one ecosystem designed specifically for the modern entertainment professional.
              </p>
              
              {!user && (
                <div className="flex flex-wrap justify-center gap-4">
                  <Link to="/auth">
                    <Button size="lg" className="h-14 px-8 rounded-2xl bg-primary text-white text-lg font-bold hover:scale-105 transition-all">
                      Start Creating Now
                    </Button>
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="px-6 mb-40">
          <div className="max-w-7xl mx-auto">
            <div className="grid gap-32">
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  id={feature.id}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className={`flex flex-col ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-12 md:gap-24 items-center scroll-mt-32`}
                >
                  <div className="flex-1 space-y-8">
                    <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center`}>
                      <feature.icon size={32} />
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">{feature.title}</h2>
                    <p className="text-muted-foreground text-lg leading-relaxed">{feature.description}</p>
                    
                    <ul className="grid grid-cols-2 gap-4">
                      {feature.details.map((detail, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-bold text-foreground/80">
                          <CheckCircle2 size={18} className="text-primary" />
                          {detail}
                        </li>
                      ))}
                    </ul>

                    <Button variant="link" className="text-primary p-0 h-auto font-black text-lg group">
                      Explore {feature.title} <ArrowRight className="ml-2 group-hover:translate-x-2 transition-transform" />
                    </Button>
                  </div>
                  
                  <div className="flex-1 w-full">
                    <div className="relative aspect-video rounded-3xl overflow-hidden border border-border group">
                      <img 
                        src={feature.image} 
                        alt={feature.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Secondary Features */}
        <section className="px-6 py-32 bg-muted/30 border-y border-border">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
              {secondaryFeatures.map((f, i) => (
                <div key={i} className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <f.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 py-40 relative">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[300px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="max-w-4xl mx-auto text-center relative z-10 glass-card-premium p-12 md:p-20 rounded-[3rem]">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-8 animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight text-foreground">
              Ready to take your craft to the <span className="text-primary">next level?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-12">
              Join thousands of filmmakers, photographers, and creative pros who are already building the future of cinema on CineCraft Connect.
            </p>
            <Link to="/auth">
              <Button size="lg" className="h-16 px-12 rounded-2xl bg-primary text-white text-xl font-black shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                Join the Community
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Features;
