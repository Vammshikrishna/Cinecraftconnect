import { Cookie, Info, ShieldCheck } from 'lucide-react';
import LegalPageLayout from '@/components/legal/LegalPageLayout';

const CookiePolicy = () => {
  const lastUpdated = "April 17, 2026";

  return (
    <LegalPageLayout 
      title="Cookie Policy"
      subtitle="Last updated"
      lastUpdated={lastUpdated}
      icon={<Cookie className="h-7 w-7 text-primary" />}
    >
      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30 hover:border-primary/20 transition-all duration-500 shadow-xl shadow-black/5">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Info className="h-6 w-6 text-primary" />
          What Are Cookies?
        </h2>
        <p className="text-muted-foreground leading-relaxed text-lg">
          Cookies are small text files that are used to store small pieces of information. They are stored on your device when the website is loaded on your browser. 
        </p>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm italic">
            Make the website function properly
          </div>
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-sm italic">
            Improve security and performance
          </div>
        </div>
      </section>

      <section className="px-6">
        <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          How We Use Cookies
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl">
          As most online services, our website uses first-party and third-party cookies for several purposes.
        </p>
        
        <div className="grid gap-6">
          {[
            {
              type: "Essential Cookies",
              desc: "Some cookies are essential for you to be able to experience the full functionality of our site. They allow us to maintain user sessions and prevent any security threats."
            },
            {
              type: "Functional Cookies",
              desc: "These cookies help certain non-essential functionalities on our website, such as embedding content like videos or sharing content on social media."
            },
            {
              type: "Analytical Cookies",
              desc: "These cookies help us understand how visitors interact with the website, providing information on metrics like the number of visitors, bounce rate, and traffic source."
            }
          ].map((cookie, i) => (
            <div key={i} className="group p-6 rounded-2xl bg-card border border-border/40 hover:border-primary/20 hover:bg-primary/5 transition-all duration-300">
              <h4 className="font-bold text-foreground text-xl mb-2 group-hover:text-primary transition-colors">{cookie.type}</h4>
              <p className="text-muted-foreground leading-relaxed">{cookie.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card p-10 rounded-3xl border-border/50 bg-card/30">
        <h2 className="text-2xl font-bold mb-6">Controlling Cookies</h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Different browsers provide different methods to block and delete cookies used by websites. You can change the settings of your browser to block/delete the cookies.
        </p>
        <a 
          href="https://allaboutcookies.org" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="inline-flex items-center px-6 py-3 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold hover:bg-primary/20 transition-all group"
        >
          More about cookies
          <Info className="ml-2 h-4 w-4 group-hover:scale-110 transition-transform" />
        </a>
      </section>

      <section className="pt-12 border-t border-border text-center pb-8">
        <p className="text-muted-foreground/60 italic text-sm">
          By using CineCraft Connect, you consent to our use of cookies as described in this policy.
        </p>
      </section>
    </LegalPageLayout>
  );
};

export default CookiePolicy;
