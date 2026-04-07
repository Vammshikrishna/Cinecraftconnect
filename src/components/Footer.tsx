import { Film, Instagram, Twitter, Youtube, Facebook, ArrowUpRight, Clapperboard, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-[#050505] pt-24 pb-12 px-6 overflow-hidden border-t border-white/[0.03]">
      {/* Cinematic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60vw] h-[20vw] bg-primary/10 blur-[120px] rounded-full opacity-30" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-12 mb-20">
          {/* Brand Section */}
          <div className="col-span-full md:col-span-4 lg:col-span-5">
            <Link to="/" className="flex items-center gap-3 mb-8 group">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/40 transition-colors duration-300">
                <Film className="h-5 w-5 text-primary group-hover:rotate-12 transition-transform duration-500" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white group-hover:text-primary transition-colors duration-300">
                CineCraft<span className="text-primary">Connect</span>
              </span>
            </Link>
            
            <p className="text-zinc-400 text-lg max-w-md mb-10 leading-relaxed">
              The premier ecosystem for the entire entertainment community. 
              Built for film, television, and digital creators to simplify production and collaboration.
            </p>

            <div className="flex items-center gap-4">
              {[
                { icon: Instagram, label: 'Instagram' },
                { icon: Twitter, label: 'Twitter' },
                { icon: Youtube, label: 'YouTube' },
                { icon: Facebook, label: 'Facebook' },
              ].map((social, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all duration-300"
                  aria-label={social.label}
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="col-span-1 md:col-span-2 lg:ml-auto"
          >
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase mb-8">Platform</h3>
            <ul className="space-y-4">
              {[
                { label: 'About', path: '/about' },
                { label: 'Features', path: '/features' },
                { label: 'Marketplace', path: '/marketplace' },
                { label: 'Pricing', path: '/pricing' },
              ].map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.path} 
                    className="text-zinc-400 hover:text-primary flex items-center gap-1 group transition-colors duration-300"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-300 outline-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="col-span-1 md:col-span-2"
          >
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase mb-8">Community</h3>
            <ul className="space-y-4">
              {[
                { label: 'Feed', path: '/feed' },
                { label: 'Network', path: '/network' },
                { label: 'Projects', path: '/projects' },
                { label: 'Job Board', path: '/jobs' },
              ].map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.path} 
                    className="text-zinc-400 hover:text-primary flex items-center gap-1 group transition-colors duration-300"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="col-span-full md:col-span-2"
          >
            <h3 className="text-white font-semibold text-sm tracking-widest uppercase mb-8">Legal</h3>
            <ul className="space-y-4">
              {[
                { label: 'Terms', path: '/terms' },
                { label: 'Privacy', path: '/privacy' },
                { label: 'Cookie', path: '/cookie' },
              ].map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.path} 
                    className="text-zinc-400 hover:text-primary flex items-center gap-1 group transition-colors duration-300"
                  >
                    {link.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Footer Bottom */}
        <div className="pt-12 border-t border-white/[0.05] flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-zinc-500 text-sm">
            &copy; {currentYear} CineCraft Connect. All rights reserved.
          </p>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Globe className="h-3.5 w-3.5" />
              <span>English (US)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
              <Clapperboard className="h-3.5 w-3.5" />
              <span>Version 2.4.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;