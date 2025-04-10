
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Film, Music, Brush, Scissors, Mic, Users, Laptop } from "lucide-react";
import { Link } from "react-router-dom";

// Expanded crafts information with descriptions
const craftsInfo = [
  {
    name: "Direction",
    description: "Leaders who guide the creative and technical aspects of film production, shaping the overall vision of the project.",
    icon: <Film className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Cinematography",
    description: "Artists who capture the visual elements of film, responsible for lighting, framing, and camera movement.",
    icon: <Camera className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Production Design",
    description: "Creators who design and build the physical world of the film, including sets, locations, and visual environments.",
    icon: <Brush className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Editing",
    description: "Storytellers who assemble footage into a coherent narrative, controlling pacing, rhythm, and emotional impact.",
    icon: <Scissors className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Sound Design",
    description: "Audio specialists who create, record, mix, and edit all sounds in a film, from dialogue to effects.",
    icon: <Mic className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Screenwriting",
    description: "Writers who develop the screenplay, creating characters, dialogue, and narrative structure.",
    icon: <Laptop className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Acting",
    description: "Performers who bring characters to life through emotional and physical interpretation of the script.",
    icon: <Users className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  {
    name: "Music Composition",
    description: "Musicians who create original scores and songs that enhance the emotional impact of scenes.",
    icon: <Music className="h-8 w-8 text-cinesphere-purple mb-2" />,
  },
  // We show 8 crafts here but indicate there are 24 total
];

const AllCraftsPage = () => {
  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <Button asChild variant="outline" className="mb-8 border-white/20 hover:bg-white/5">
            <Link to="/explore" className="flex items-center">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Explore
            </Link>
          </Button>
          
          <div className="glass-card rounded-xl p-8 md:p-12 mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center">
              The 24 Film Crafts
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8 text-center">
              Filmmaking is a collaborative art form that brings together a diverse range of specialized crafts. 
              Each craft contributes unique skills and perspectives to create the magic we see on screen.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {craftsInfo.map((craft) => (
              <div key={craft.name} className="glass-card rounded-xl p-6 flex flex-col h-full">
                <div className="flex flex-col items-center text-center mb-4">
                  {craft.icon}
                  <h3 className="text-xl font-semibold mb-2">{craft.name}</h3>
                </div>
                <p className="text-gray-300">{craft.description}</p>
                <Button asChild variant="outline" className="mt-auto border-white/20 hover:bg-white/5 w-full">
                  <Link to={`/craft/${craft.name.toLowerCase().replace(' ', '-')}`}>
                    Explore {craft.name}
                  </Link>
                </Button>
              </div>
            ))}
          </div>
          
          <div className="glass-card rounded-xl p-8 text-center">
            <h3 className="text-xl font-semibold mb-4">Discover All 24 Film Crafts</h3>
            <p className="text-gray-300 mb-6">
              CineSphere connects professionals across all 24 recognized film crafts. Beyond the crafts shown above, 
              we also support specialists in costume design, visual effects, animation, makeup, stunt coordination, 
              casting, art direction, color grading, and many more.
            </p>
            <Button asChild className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
              <Link to="/network">Find Professionals by Craft</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AllCraftsPage;
