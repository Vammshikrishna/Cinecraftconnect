import { motion } from "framer-motion";
import { Users, Globe, Target } from "lucide-react";
import Footer from "@/components/Footer";

const About = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      
      <main className="pt-32">
        <section className="px-6 mb-32 text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
              Our Mission: <br />
              <span className="text-primary">Empowering Creators.</span>
            </h1>
            <p className="text-muted-foreground text-xl leading-relaxed">
              CineCraft Connect was born from a simple observation: the entertainment industry is built on collaboration, yet the tools we use are fragmented. We're here to change that.
            </p>
          </motion.div>
        </section>

        <section className="px-6 mb-40">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { 
                title: "Community First", 
                icon: Users, 
                desc: "We believe the best work happens when creators support one another. Our platform is built to foster genuine connections." 
              },
              { 
                title: "Innovation Driven", 
                icon: Target, 
                desc: "From real-time collaboration to advanced project management, we're constantly pushing the boundaries of what's possible." 
              },
              { 
                title: "Global Reach", 
                icon: Globe, 
                desc: "Cinema has no borders. We connect professionals from Hollywood to Mumbai, and everywhere in between." 
              }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card-premium p-8 rounded-[2rem] border-border/40 hover:border-primary/20 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <item.icon size={24} />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="px-6 mb-40 relative">
          <div className="max-w-7xl mx-auto bg-primary/5 rounded-[3rem] p-12 md:p-24 border border-border relative overflow-hidden">
             <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 blur-[120px] -mr-48 -mt-48 rounded-full" />
             
             <div className="relative z-10 grid md:grid-cols-2 gap-16 items-center">
                <div className="space-y-8">
                  <h2 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">The Story Behind <br />CineCraft</h2>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Founded by a team of filmmakers and tech enthusiasts, CineCraft Connect was built to solve the real-world problems we faced on set. We knew there had to be a better way to find gear, hire crew, and manage productions.
                  </p>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Today, we're proud to support a growing community of thousands of creators who are using our platform to bring their visions to life.
                  </p>
                </div>
                <div className="relative">
                  <div className="aspect-video rounded-[2rem] overflow-hidden border border-border shadow-2xl group">
                    <img 
                      src="/assets/about_showcase.png" 
                      alt="CineCraft Connect Interface" 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                  </div>
                  {/* Decorative Elements */}
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-primary/20 blur-3xl rounded-full" />
                </div>
             </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
