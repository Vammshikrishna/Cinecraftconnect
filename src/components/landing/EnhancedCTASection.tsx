import { ArrowRight, Sparkles, Users, Film } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { Card } from "@/components/ui/card";

const EnhancedCTASection = () => {
  const ctaContent = {
    superhead: 'Built for the Future of Film',
    headline: 'Ready to Create Your Next Masterpiece?',
    subhead: 'Whether you\'re a seasoned professional or just starting out, CineCraft Connect is where your next great collaboration begins.',
    buttons: [
      {
        text: 'Join CineCraft Connect',
        href: '/auth',
        icon: Users,
        primary: true,
      },
      {
        text: 'Explore Projects',
        href: '/explore',
        icon: Film,
        primary: false,
      },
    ],
    features: [
      {
        title: 'Free',
        description: 'Always free to join',
      },
      {
        title: '24/7',
        description: 'Global community',
      },
      {
        title: 'Instant',
        description: 'Start connecting today',
      },
    ],
  };

  return (
    <section className="py-24 px-4 md:px-8 bg-gradient-to-r from-cinecraft-connect-purple/20 via-cinecraft-connect-dark to-cinecraft-connect-blue/20 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-32 h-32 bg-cinecraft-connect-purple rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-cinecraft-connect-blue rounded-full blur-3xl animate-pulse" style={{
          animationDelay: '1s'
        }}></div>
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center justify-center bg-cinecraft-connect-dark-200/50 border border-cinecraft-connect-light-purple/20 rounded-full px-4 py-1 mb-6">
          <Sparkles className="h-5 w-5 text-cinecraft-connect-light-purple mr-2" />
          <span className="text-sm text-gray-300 font-medium tracking-wide">{ctaContent.superhead}</span>
        </div>

        <h2 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          <span className="text-gradient bg-gradient-to-r from-white via-cinecraft-connect-light-purple to-cinecraft-connect-blue bg-clip-text text-transparent">
            {ctaContent.headline}
          </span>
        </h2>

        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          {ctaContent.subhead}
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
          {ctaContent.buttons.map((button, index) => (
            <Button key={index} asChild size="lg" className={`${button.primary ? 'bg-gradient-to-r from-cinecraft-connect-purple to-cinecraft-connect-blue hover:from-cinecraft-connect-purple/90 hover:to-cinecraft-connect-blue/90 shadow-2xl hover:shadow-cinecraft-connect-purple/25' : 'border-2 border-white/30 hover:bg-white/10 backdrop-blur-sm'} text-lg px-8 py-4 h-auto`}>
              <Link to={button.href} className="flex items-center">
                <button.icon className="mr-2 h-5 w-5" />
                {button.text}
                {button.primary && <ArrowRight className="ml-2 h-5 w-5" />}
              </Link>
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {ctaContent.features.map((feature, index) => (
            <Card key={index} className="bg-white/5 border-white/10 p-6 rounded-xl transform hover:scale-105 transition-transform duration-300">
              <div className="text-3xl font-bold text-white">{feature.title}</div>
              <div className="text-sm text-gray-400">{feature.description}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EnhancedCTASection;
