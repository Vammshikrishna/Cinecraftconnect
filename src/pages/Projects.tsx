
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Film, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import StarRating from "@/components/StarRating";

const Projects = () => {
  // Mock project data with ratings
  const projects = [
    {
      id: 1,
      title: "Echoes in Silence",
      type: "Short Film",
      role: "Director",
      status: "In Production",
      collaborators: 8,
      rating: 4.5,
    },
    {
      id: 2,
      title: "Neon Dreams",
      type: "Music Video",
      role: "Cinematographer",
      status: "Completed",
      collaborators: 12,
      rating: 4.8,
    },
    {
      id: 3,
      title: "Beyond the Stars",
      type: "Feature Film",
      role: "Production Designer",
      status: "Pre-Production",
      collaborators: 24,
      rating: 3.9,
    }
  ];

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Projects</h1>
            <Button className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
              <Plus size={16} className="mr-2" /> Create Project
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div key={project.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{project.title}</h3>
                    <p className="text-sm text-gray-400">{project.type}</p>
                  </div>
                  <span className="px-2 py-1 text-xs rounded-full bg-cinesphere-purple/30 text-cinesphere-purple">
                    {project.status}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <Film size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-400">Your role: {project.role}</span>
                </div>
                
                <div className="flex justify-between items-center mb-5">
                  <span className="text-sm text-gray-400">{project.collaborators} collaborators</span>
                  <StarRating rating={project.rating} readOnly showValue size={16} />
                </div>
                
                <Link to={`/projects/${project.id}`} className="flex items-center text-cinesphere-purple hover:underline">
                  View Project <ArrowRight size={16} className="ml-2" />
                </Link>
              </div>
            ))}
            
            {/* Create New Project Card */}
            <div className="border border-dashed border-white/20 rounded-xl p-6 flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-cinesphere-purple/20 flex items-center justify-center mb-4">
                <Plus size={24} className="text-cinesphere-purple" />
              </div>
              <h3 className="text-xl font-semibold mb-1">Start a New Project</h3>
              <p className="text-sm text-gray-400 mb-4">Create a project space to collaborate with others</p>
              <Button variant="outline" className="border-cinesphere-purple text-cinesphere-purple">
                Create Project
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Projects;
