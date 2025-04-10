
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { Search, MapPin, Clock, Briefcase, Filter, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Jobs = () => {
  // Mock job listings
  const jobs = [
    {
      id: 1,
      title: "Cinematographer for Short Film",
      company: "Horizon Productions",
      location: "Los Angeles, CA",
      type: "Freelance",
      posted: "2 days ago",
      salary: "$500/day",
    },
    {
      id: 2,
      title: "Sound Designer",
      company: "Echo Studios",
      location: "New York, NY",
      type: "Contract",
      posted: "1 week ago",
      salary: "$4,000-6,000",
    },
    {
      id: 3,
      title: "Production Assistant",
      company: "Stellar Films",
      location: "Atlanta, GA",
      type: "Full-time",
      posted: "3 days ago",
      salary: "$45,000/year",
    },
    {
      id: 4,
      title: "Costume Designer for Period Drama",
      company: "Heritage Pictures",
      location: "Toronto, Canada",
      type: "Project-based",
      posted: "5 days ago",
      salary: "Negotiable",
    },
  ];

  return (
    <div className="min-h-screen bg-cinesphere-dark">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Jobs</h1>
            <Button className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
              Post a Job
            </Button>
          </div>

          {/* Search and Filter Bar */}
          <div className="glass-card rounded-xl p-4 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input 
                  placeholder="Search for jobs..."
                  className="pl-10 bg-cinesphere-dark/50 border-white/10"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-white/20">
                  <Filter size={18} className="mr-2" /> Filters
                </Button>
                <Button variant="outline" className="border-white/20">
                  <ArrowUpDown size={18} className="mr-2" /> Sort
                </Button>
              </div>
            </div>
          </div>

          {/* Job Listings */}
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold mb-1">{job.title}</h3>
                    <p className="text-sm text-gray-400 mb-3">{job.company}</p>
                    
                    <div className="flex flex-wrap gap-3 text-sm text-gray-300">
                      <div className="flex items-center">
                        <MapPin size={16} className="mr-1 text-gray-400" />
                        {job.location}
                      </div>
                      <div className="flex items-center">
                        <Briefcase size={16} className="mr-1 text-gray-400" />
                        {job.type}
                      </div>
                      <div className="flex items-center">
                        <Clock size={16} className="mr-1 text-gray-400" />
                        {job.posted}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end justify-between">
                    <span className="font-medium text-cinesphere-purple">{job.salary}</span>
                    <Button className="mt-2 md:mt-0">
                      Apply Now
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Jobs;
