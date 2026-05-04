import { Link } from 'react-router-dom';
import { useRef, useEffect, useState, useMemo } from 'react';
import {
  Film, Users, Briefcase, ShoppingBag,
  Sparkles, Shield, Globe, Lock, Star,
  ArrowRight, Camera, Mic, Headphones,
  Play, Zap
} from 'lucide-react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import DiscussionRoomIcon from '@/components/icons/DiscussionRoomIcon';
import Footer from '@/components/Footer';
import LandingNavbar from '@/components/landing/LandingNavbar';
import SEO from '@/components/common/SEO';

/* ─────────────────────────────────────────────
   Reusable: scroll-reveal wrapper
   ───────────────────────────────────────────── */
const Reveal = ({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'left' | 'right';
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  const initial = {
    opacity: 0,
    y: direction === 'up' ? 40 : 0,
    x: direction === 'left' ? -40 : direction === 'right' ? 40 : 0,
  };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : initial}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/* ─────────────────────────────────────────────
   Film-strip decoration (pure CSS/SVG)
   ───────────────────────────────────────────── */
const FilmStrip = ({ className = '' }: { className?: string }) => (
  <div className={`pointer-events-none select-none ${className}`} aria-hidden>
    <svg width="48" height="600" viewBox="0 0 48 600" fill="none" className="opacity-[0.07]">
      {Array.from({ length: 20 }).map((_, i) => (
        <g key={i}>
          <rect x="0" y={i * 30} width="48" height="28" rx="2" stroke="currentColor" strokeWidth="1" fill="none" />
          <rect x="4" y={i * 30 + 4} width="6" height="6" rx="1" fill="currentColor" />
          <rect x="38" y={i * 30 + 4} width="6" height="6" rx="1" fill="currentColor" />
          <rect x="4" y={i * 30 + 18} width="6" height="6" rx="1" fill="currentColor" />
          <rect x="38" y={i * 30 + 18} width="6" height="6" rx="1" fill="currentColor" />
        </g>
      ))}
    </svg>
  </div>
);



/* ─────────────────────────────────────────────
   Typewriter headline
   ───────────────────────────────────────────── */
const roles = ['Directors', 'Content Creators', 'YouTubers', 'Cinematographers', 'Editors', 'Producers', 'TV Producers', 'Sound Designers', 'Writers', 'Actors', 'VFX Artists'];

const TypewriterRole = () => {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = roles[index];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && displayed.length < current.length) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 80);
    } else if (!isDeleting && displayed.length === current.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayed.length > 0) {
      timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length - 1)), 40);
    } else {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1) % roles.length);
    }

    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, index]);

  return (
    <span className="text-primary">
      {displayed}
      <span className="animate-pulse">|</span>
    </span>
  );
};

/* ─────────────────────────────────────────────
   Main Landing Page
   ───────────────────────────────────────────── */
const Index = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);

  const features = useMemo(() => [
    {
      icon: Film,
      title: 'Project Spaces',
      desc: 'Dedicated workspaces for every production — from short films to feature-length projects. Organize scripts, shot lists, call sheets, and team roles all in one place.',
      accent: 'from-primary to-accent',
    },
    {
      icon: Users,
      title: 'Crew Network',
      desc: 'Build your professional circle. Search by craft, location, and availability. Find the perfect DP, gaffer, or sound mixer for your next shoot.',
      accent: 'from-sky-500 to-blue-600',
    },
    {
      icon: DiscussionRoomIcon,
      title: 'Discussion Rooms',
      desc: 'Real-time conversations with your crew. Share references, give feedback on cuts, and brainstorm ideas — with threads, reactions, and file sharing built in.',
      accent: 'from-violet-500 to-purple-600',
    },
    {
      icon: Briefcase,
      title: 'Job Board',
      desc: 'Post crew calls, find gigs, and apply with your CineCraft profile. From indie productions to studio-level shoots, every opportunity in one feed.',
      accent: 'from-amber-500 to-orange-600',
    },
    {
      icon: ShoppingBag,
      title: 'Marketplace & Vendors',
      desc: 'Source high-end gear, rent production equipment, and connect with trusted industry vendors for everything from catering to VFX houses.',
      accent: 'from-blue-500 to-indigo-600',
    },
    {
      icon: Star,
      title: 'Ratings & Reviews',
      desc: 'Discover films, rate what you\'ve watched, and see what the community thinks. A Letterboxd-style layer built for industry professionals.',
      accent: 'from-yellow-500 to-amber-600',
    },
  ], []);



  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <SEO 
        title="Welcome" 
        description="Connect with the global entertainment community. Find jobs, build projects, and showcase your talent in a premium digital workspace." 
      />
      <LandingNavbar />

      {/* ───────────── HERO ───────────── */}
      <section ref={heroRef} className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 overflow-hidden">

        {/* Cinematic ambient light — two warm diffused orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-[20%] -left-[10%] w-[60vw] h-[60vw] rounded-full blur-[140px] transform-gpu"
            style={{
              background: 'radial-gradient(circle, hsl(161 100% 40% / 0.45), transparent 70%)',
              willChange: 'transform'
            }}
            animate={{ scale: [1, 1.1, 1], x: [0, 30, 0], y: [0, 20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-[15%] -right-[5%] w-[50vw] h-[50vw] rounded-full blur-[120px] transform-gpu"
            style={{
              background: 'radial-gradient(circle, hsl(280 90% 70% / 0.40), transparent 70%)',
              willChange: 'transform'
            }}
            animate={{ scale: [1, 1.15, 1], x: [0, -25, 0], y: [0, -30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
        </div>

        {/* Film strip decorations */}
        <FilmStrip className="absolute left-2 md:left-8 top-0 h-full !opacity-40" />
        <FilmStrip className="absolute right-2 md:right-8 top-0 h-full !opacity-40" />

        {/* Floating film icons */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden aria-hidden">
          {[
            Camera, Mic, Headphones, Film, Sparkles, Play,
            Star, Users, Briefcase, ShoppingBag, Shield, DiscussionRoomIcon
          ].map((Icon, i) => {
            const positions = [
              { left: '8%', top: '15%' },
              { left: '85%', top: '22%' },
              { left: '12%', top: '75%' },
              { left: '88%', top: '65%' },
              { left: '75%', top: '85%' },
              { left: '20%', top: '88%' },
              { left: '5%', top: '45%' },
              { left: '92%', top: '40%' },
              { left: '45%', top: '10%' },
              { left: '60%', top: '8%' },
              { left: '30%', top: '40%' },
              { left: '72%', top: '45%' },
            ];
            return (
              <motion.div
                key={i}
                className="absolute text-foreground/[0.15] transform-gpu"
                style={{ ...positions[i], willChange: 'transform' }}
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, i % 2 === 0 ? 8 : -8, 0],
                }}
                transition={{
                  duration: 6 + (i % 4),
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.3,
                }}
              >
                <Icon size={24} strokeWidth={1.5} />
              </motion.div>
            );
          })}
        </div>

        {/* Hero content */}
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Brand pill */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 glass-card px-5 py-2.5 rounded-full mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-muted-foreground tracking-wide">
              Now open for the entertainment community worldwide
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6"
          >
            Where{' '}
            <span className="relative inline-block">
              <TypewriterRole />
            </span>
            <br className="hidden sm:block" />
            <span className="text-foreground"> find their next crew.</span>
          </motion.h1>

          {/* Sub-copy */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            CineCraft Connect is the professional network built for the entire
            entertainment ecosystem. From Movies & TV to YouTube & Social Media,
            manage productions, discover talent, and collaborate — all in one platform.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/register">
              <button className="glass-button-primary px-8 py-4 text-base font-semibold hover-scale click-effect group flex items-center gap-2">
                Join the Community
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link to="/auth">
              <button className="glass-button px-8 py-4 text-base font-semibold hover-scale click-effect flex items-center gap-2">
                <Play className="h-4 w-4" />
                Sign In
              </button>
            </Link>
          </motion.div>

          {/* Trust line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="mt-8 text-xs text-muted-foreground/60 tracking-wide"
          >
            Free to use · No credit card · Built by creators, for creators
          </motion.p>
        </motion.div>
      </section>



      {/* ───────────── WHAT YOU CAN DO ───────────── */}
      <section className="py-24 md:py-32 px-4 relative">
        {/* Section background accent */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 right-0 w-[40vw] h-[40vw] rounded-full blur-[150px] bg-primary/[0.06]" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal>
            <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-3">
                  Everything you need
                </p>
                <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
                  One platform for your
                  <br />
                  entire production.
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  From pre-production to wrap, CineCraft Connect replaces a dozen apps with
                  tools designed specifically for how film crews actually work.
                </p>
              </div>
              <Link to="/features" className="group flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-widest hover:opacity-80 transition-opacity">
                View All Features
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <Reveal key={i} delay={i * 0.08} className="h-full">
                <Link 
                  to={feature.title.toLowerCase().includes('project') ? '/features#projects' : 
                      feature.title.toLowerCase().includes('marketplace') ? '/features#marketplace' :
                      feature.title.toLowerCase().includes('job') ? '/features#jobs' :
                      feature.title.toLowerCase().includes('discussion') ? '/features#discussions' :
                      feature.title.toLowerCase().includes('network') ? '/features#network' : '/features'}
                  className="group block h-full"
                >
                  <div className="glass-card p-7 rounded-2xl h-full flex flex-col transition-all duration-300 hover:translate-y-[-4px] hover:shadow-lg hover:shadow-primary/5 border border-border/50 hover:border-primary/20">
                    {/* Icon */}
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.accent} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <feature.icon className="h-5 w-5 text-white" strokeWidth={2} />
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed flex-1">{feature.desc}</p>
                    
                    <div className="mt-4 flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                      Learn More <ArrowRight size={12} />
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── THE CRAFT — VISUAL SHOWCASE ───────────── */}
      <section className="py-24 md:py-32 px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-[10%] w-[50vw] h-[30vw] rounded-full blur-[160px] bg-secondary/[0.06]" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left — Text */}
            <Reveal direction="left">
              <div>
                <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-3">
                  Built for the set
                </p>
                <h2 className="text-3xl md:text-5xl font-bold leading-tight mb-6">
                  Your crew, your projects,
                  <br />
                  your way.
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                  Whether you&apos;re organizing a 3-day indie shoot or coordinating a
                  multi-unit production, CineCraft adapts to the way you work — not the
                  other way around.
                </p>

                <div className="space-y-5">
                  {[
                    { icon: Zap, text: 'Real-time collaboration with your crew' },
                    { icon: Shield, text: 'Private projects with role-based access' },
                    { icon: Globe, text: 'Public portfolio to showcase your reel' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Right — Visual card stack */}
            <Reveal direction="right" delay={0.15}>
              <div className="relative">
                {/* Back card */}
                <motion.div
                  className="absolute top-4 left-4 right-[-8px] bottom-[-8px] glass-card rounded-2xl border border-border/30"
                  animate={{ rotate: [2, 2.5, 2] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Main card — a mock project space */}
                <div className="relative glass-card rounded-2xl p-6 border border-border/50">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Film className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">Midnight Horizon</div>
                      <div className="text-xs text-muted-foreground">Feature Film · In Production</div>
                    </div>
                    <div className="ml-auto glass-badge text-primary text-[10px] font-bold uppercase tracking-wider">
                      Active
                    </div>
                  </div>

                  {/* Mock crew avatars */}
                  <div className="flex items-center mb-5">
                    <div className="flex -space-x-2">
                      {['bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-primary'].map((bg, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-background flex items-center justify-center text-[10px] text-white font-bold`}>
                          {['D', 'J', 'S', 'M', 'R'][i]}
                        </div>
                      ))}
                    </div>
                    <span className="ml-3 text-xs text-muted-foreground">+8 crew members</span>
                  </div>

                  {/* Mock progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">Production Progress</span>
                      <span className="text-primary font-medium">67%</span>
                    </div>
                    <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                        initial={{ width: '0%' }}
                        whileInView={{ width: '67%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* Mock task list */}
                  <div className="space-y-2">
                    {['Location scout — Completed', 'Table read — Tomorrow 4 PM', 'Shot list review — In progress'].map((task, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-emerald-400' : i === 2 ? 'bg-amber-400' : 'bg-sky-400'}`} />
                        <span className="text-muted-foreground">{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────── ROLES MARQUEE ───────────── */}
      <section className="py-12 border-y border-border/40 overflow-hidden">
        <motion.div
          className="flex gap-8 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex gap-8 items-center">
              {[
                'Directors', 'Cinematographers', 'Editors', 'Producers', 'Sound Designers',
                'Writers', 'Actors', 'VFX Artists', 'Production Designers', 'Gaffers',
                'Colorists', 'Composers', 'Script Supervisors', 'Stunt Coordinators',
              ].map((role, i) => (
                <div key={i} className="flex items-center gap-2 text-muted-foreground/40 text-sm font-medium">
                  <Film className="h-3.5 w-3.5" />
                  {role}
                </div>
              ))}
            </div>
          ))}
        </motion.div>
      </section>

      {/* ───────────── TRUST / SECURITY ───────────── */}
      <section className="py-24 md:py-32 px-4">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="glass-card rounded-3xl p-10 md:p-16 border border-border/50 relative overflow-hidden">
              {/* Background accent */}
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-[100px] bg-primary/10 pointer-events-none" />

              <div className="relative z-10 grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-3">
                    Privacy first
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                    Your creative work
                    <br />
                    stays yours.
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Enterprise-grade encryption, granular permissions, and full control over
                    who sees your projects, drafts, and portfolio. Share when you&apos;re ready —
                    not before.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: Lock, title: 'Private by default', desc: 'Projects are invite-only unless you choose otherwise.' },
                    { icon: Shield, title: 'Encrypted data', desc: 'All files and messages encrypted at rest and in transit.' },
                    { icon: Globe, title: 'Public portfolio', desc: 'Showcase your reel & credits on your own terms.' },
                    { icon: Users, title: 'Role-based access', desc: 'Control who can view, edit, or manage each project.' },
                  ].map((item, i) => (
                    <Reveal key={i} delay={i * 0.1}>
                      <div className="p-4 rounded-xl bg-background/50 border border-border/30 hover:border-primary/20 transition-colors duration-300">
                        <item.icon className="h-5 w-5 text-primary mb-2" />
                        <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section className="py-24 md:py-32 px-4 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-[20%] w-[40vw] h-[30vw] rounded-full blur-[160px] bg-primary/[0.04]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-primary font-semibold text-sm tracking-widest uppercase mb-3">
                Get started in minutes
              </p>
              <h2 className="text-3xl md:text-5xl font-bold">
                Three steps to your next project.
              </h2>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {[
              {
                step: '01',
                icon: Users,
                title: 'Create your profile',
                desc: 'Showcase your craft, experience, and reel. Let the industry know what you bring to the set.',
              },
              {
                step: '02',
                icon: Film,
                title: 'Start or join a project',
                desc: 'Create your own production workspace or join an existing crew that needs your skills.',
              },
              {
                step: '03',
                icon: Sparkles,
                title: 'Collaborate & grow',
                desc: 'Work with your team in real time, build your network, and land your next gig.',
              },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 0.12}>
                <div className="text-center relative">
                  {/* Step number circle */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20 relative z-10">
                    <item.icon className="h-5 w-5 text-white" />
                  </div>

                  <div className="text-xs font-bold text-primary/50 tracking-widest uppercase mb-2">
                    Step {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── FINAL CTA ───────────── */}
      <section className="py-24 md:py-32 px-4">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to find your crew?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
              Join thousands of entertainment professionals already building
              their next project on CineCraft Connect.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <button className="glass-button-primary px-10 py-5 text-base font-semibold hover-scale click-effect group flex items-center gap-2">
                  Get Started — It&apos;s Free
                  <Sparkles className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                </button>
              </Link>
            </div>

          </div>
        </Reveal>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
