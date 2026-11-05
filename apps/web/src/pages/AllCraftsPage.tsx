import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Camera, Film, Music, Brush, Scissors, Mic, Users, Laptop } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppNavigation } from '@/contexts/NavigationContext';
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { craftSlug } from "./craftMapping";

// Expanded crafts information with descriptions
const craftsInfo = [
  {
    name: "Direction",
    description: "Leaders who guide the creative and technical aspects of film production, shaping the overall vision of the project.",
    icon: <Film className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Cinematography",
    description: "Artists who capture the visual elements of film, responsible for lighting, framing, and camera movement.",
    icon: <Camera className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Production Design",
    description: "Creators who design and build the physical world of the film, including sets, locations, and visual environments.",
    icon: <Brush className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Editing",
    description: "Storytellers who assemble footage into a coherent narrative, controlling pacing, rhythm, and emotional impact.",
    icon: <Scissors className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Sound Design",
    description: "Audio specialists who create, record, mix, and edit all sounds in a film, from dialogue to effects.",
    icon: <Mic className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Screenwriting",
    description: "Writers who develop the screenplay, creating characters, dialogue, and narrative structure.",
    icon: <Laptop className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Acting",
    description: "Performers who bring characters to life through emotional and physical interpretation of the script.",
    icon: <Users className="h-8 w-8 text-primary mb-2" />,
  },
  {
    name: "Music Composition",
    description: "Musicians who create original scores and songs that enhance the emotional impact of scenes.",
    icon: <Music className="h-8 w-8 text-primary mb-2" />,
  },
];

const AllCraftsPage = () => {
  const { push } = useAppNavigation();
  const { user } = useAuth();

  return (
    <div className="min-h-dvh bg-background selection:bg-primary/30">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <main className="max-w-[1560px] mx-auto px-4 md:px-8 pt-20 pb-40 relative z-10">
        <PageHeader 
          title="Film Crafts" 
          subtitle="Filmmaking is a collaborative art form that brings together a diverse range of specialized crafts. Each craft contributes unique skills to the magic of cinema." 
          Icon={Film}
          onBack={() => push(user ? '/feed' : '/', { noScroll: true })}
        />

        <div className="max-w-[1400px] mx-auto mt-12">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6 md:gap-8 mb-16">
            {craftsInfo.map((craft) => (
              <div key={craft.name} className="bg-card/40 border border-border/50 rounded-[2.5rem] p-6 sm:p-8 flex flex-col h-full group hover:border-primary/30 hover:shadow-2xl transition duration-500 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/[0.03] to-transparent" />
                
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="bg-primary/10 p-4 rounded-2xl mb-4 [@media(hover:hover)]:group-hover:scale-110 transition-transform duration-300">
                    {craft.icon}
                  </div>
                  <h3 className="text-2xl font-black tracking-tight group-hover:text-primary transition-colors">{craft.name}</h3>
                </div>
                <p className="text-muted-foreground text-center font-medium leading-relaxed mb-8 flex-1">
                  {craft.description}
                </p>
                <Button asChild variant="ghost" className="mt-auto h-12 w-full rounded-2xl border border-border/50 hover:bg-muted/50 font-black uppercase tracking-widest text-xs">
                  <Link to={`/craft/${craftSlug(craft.name)}`}>
                    Explore {craft.name}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
          
          <div className="bg-primary/5 border border-primary/20 rounded-[3rem] p-10 md:p-16 text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <h3 className="text-3xl md:text-4xl font-black tracking-tight">Discover More Film Crafts</h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
              CineCraft Connect connects professionals across many film crafts. Beyond the ones shown above, 
              we support everything from{' '}
              {[['Costume Design', 'costume-design'], ['VFX', 'vfx'], ['Animation', 'animation'], ['Makeup', 'makeup'], ['Stunt Coordination', 'stunt-coordination'], ['Casting', 'casting']].map(([label, slug], i, arr) => (
                <span key={slug}>
                  <Link to={`/craft/${craftSlug(label)}`} className="underline underline-offset-4 decoration-primary/40 hover:text-foreground">{label}</Link>
                  {i < arr.length - 1 ? ', ' : ''}
                </span>
              ))}
              , and more.
            </p>
            <div className="pt-4">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black px-12 h-16 rounded-2xl text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-transform">
                <Link to="/network" className="flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  Find Professionals by Craft
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AllCraftsPage;
