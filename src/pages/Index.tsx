import { Link } from 'react-router-dom';
import {
  Film, Users, MessageSquare, Briefcase, Video,
  Sparkles, Shield, Globe, Lock, Bell,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

const Index = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center space-y-8">
          {/* Logo/Brand */}
          <div className="inline-flex items-center gap-3 glass-card px-6 py-3 rounded-full mb-4">
            <Film className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold text-gradient">CineCraft Connect</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            <span className="text-gradient">Connect. Create.</span>
            <br />
            <span className="text-foreground">Collaborate.</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
            The ultimate platform for film & TV professionals to network,
            collaborate on projects, and bring creative visions to life.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link to="/register">
              <button className="glass-button-primary px-8 py-4 text-lg font-semibold hover-scale click-effect group">
                Get Started Free
                <ArrowRight className="inline-block ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <Link to="/auth">
              <button className="glass-button px-8 py-4 text-lg font-semibold hover-scale click-effect">
                Sign In
              </button>
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-primary/30 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-primary rounded-full"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">Powerful Features</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your film & TV projects in one place
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Film,
                title: 'Project Spaces',
                description: 'Create and manage film projects with dedicated workspaces, team collaboration, and production tools.',
                features: ['Private & Public Projects', 'Team Management', 'File Sharing', 'Call Sheets & Shot Lists']
              },
              {
                icon: MessageSquare,
                title: 'Discussion Rooms',
                description: 'Real-time chat rooms for creative discussions, brainstorming, and community engagement.',
                features: ['Private & Public Rooms', 'Real-time Chat', 'File Sharing', 'Video Calls']
              },
              {
                icon: Users,
                title: 'Professional Network',
                description: 'Connect with industry professionals, build your network, and discover collaboration opportunities.',
                features: ['Profile Showcase', 'Portfolio Display', 'Skill Matching', 'Direct Messaging']
              },
              {
                icon: Briefcase,
                title: 'Job Board',
                description: 'Find and post film industry jobs, from crew positions to creative roles.',
                features: ['Job Listings', 'Applications', 'Saved Jobs', 'Role Matching']
              },
              {
                icon: Video,
                title: 'Video Calls',
                description: 'Built-in video conferencing for remote collaboration and virtual production meetings.',
                features: ['HD Video', 'Screen Sharing', 'Recording', 'Chat Integration']
              },
              {
                icon: Bell,
                title: 'Smart Notifications',
                description: 'Stay updated with intelligent notifications for messages, project updates, and opportunities.',
                features: ['Real-time Alerts', 'Custom Preferences', 'Email Digest', 'Mobile Push']
              }
            ].map((feature, index) => (
              <div key={index} className="group relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-accent to-secondary rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition duration-500"></div>
                <div className="relative glass-card-hover p-8 rounded-2xl h-full space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
                    <feature.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  <ul className="space-y-2 pt-4">
                    {feature.features.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy & Security Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-transparent to-primary/5">
        <div className="max-w-6xl mx-auto">
          <div className="glass-card-hover rounded-3xl p-12 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mb-6">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-4xl font-bold mb-4">
              <span className="text-gradient">Privacy & Security First</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Your creative work is protected with enterprise-grade security and granular privacy controls.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-12">
              {[
                { icon: Lock, title: 'Private Projects', desc: 'Control who sees your work' },
                { icon: Shield, title: 'Secure Data', desc: 'End-to-end encryption' },
                { icon: Globe, title: 'Public Showcase', desc: 'Share when you\'re ready' }
              ].map((item, index) => (
                <div key={index} className="glass-card-hover p-6 rounded-2xl text-center hover-lift">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient">How It Works</span>
            </h2>
            <p className="text-xl text-muted-foreground">Get started in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { step: '01', title: 'Create Profile', desc: 'Sign up and showcase your skills, experience, and portfolio', icon: Users },
              { step: '02', title: 'Join Projects', desc: 'Find projects that match your skills or create your own', icon: Film },
              { step: '03', title: 'Collaborate', desc: 'Work with teams, share ideas, and bring visions to life', icon: Sparkles }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="glass-card-hover p-8 rounded-2xl text-center space-y-4 hover-lift h-full">
                  <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20">
                    <item.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
                {index < 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-6 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-8 w-8 text-primary/40" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-secondary rounded-3xl opacity-20 blur-2xl group-hover:opacity-30 transition duration-500"></div>
            <div className="relative glass-card-hover rounded-3xl p-12 md:p-16 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                <span className="text-gradient">Ready to Get Started?</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of film & TV professionals already collaborating on CineCraft Connect
              </p>
              <Link to="/register">
                <button className="glass-button-primary px-10 py-5 text-lg font-semibold hover-scale click-effect group">
                  Create Free Account
                  <Sparkles className="inline-block ml-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                </button>
              </Link>
              <p className="text-sm text-muted-foreground mt-6">
                No credit card required • Free forever • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;