
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, User, MapPin, Link as LinkIcon, Film, Camera, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StarRating from "@/components/StarRating";
import { PortfolioGrid } from "@/components/portfolio/PortfolioGrid";
import { PortfolioUpload } from "@/components/portfolio/PortfolioUpload";

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPortfolioUpload, setShowPortfolioUpload] = useState(false);
  const [formData, setFormData] = useState({
    username: "john_director",
    full_name: "John Director",
    bio: "Passionate filmmaker with 10+ years of experience in independent cinema.",
    craft: "Director",
    location: "Los Angeles, CA",
    website: "johndirector.com"
  });

  // Sample movie ratings (in a real app, fetch from the database)
  const movieRatings = [
    { title: "The Godfather", rating: 4.8, releaseDate: "1972", type: "Movie" as const },
    { title: "Pulp Fiction", rating: 4.5, releaseDate: "1994", type: "Movie" as const },
    { title: "La La Land", rating: 4.2, releaseDate: "2016", type: "Movie" as const }
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Simulate profile update
      setIsEditing(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated"
      });
    } catch (error: any) {
      toast({
        title: "Error updating profile",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cinesphere-dark to-black">
      <Navbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="mb-8 bg-black/30 backdrop-blur-sm border border-white/10 rounded-lg">
              <TabsTrigger value="profile" className="data-[state=active]:bg-cinesphere-purple/20">
                <User size={16} className="mr-2" /> Profile
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="data-[state=active]:bg-cinesphere-purple/20">
                <Briefcase size={16} className="mr-2" /> Portfolio
              </TabsTrigger>
              <TabsTrigger value="watchlist" className="data-[state=active]:bg-cinesphere-purple/20">
                <Film size={16} className="mr-2" /> Watchlist & Ratings
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile">
              <div className="glass-card rounded-xl p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
                  <div className="flex items-center mb-4 md:mb-0">
                    <Avatar className="h-16 w-16 mr-4">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue text-white text-xl">
                        {getInitials(formData.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold">{formData.full_name}</h1>
                      <p className="text-cinesphere-purple">{formData.craft}</p>
                    </div>
                  </div>
                  {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                      Edit Profile
                    </Button>
                  )}
                </div>
                
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="username" className="text-sm font-medium">Username</label>
                        <Input
                          id="username"
                          name="username"
                          value={formData.username}
                          onChange={handleChange}
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="full_name" className="text-sm font-medium">Full Name</label>
                        <Input
                          id="full_name"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleChange}
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="craft" className="text-sm font-medium">Primary Craft</label>
                        <Input
                          id="craft"
                          name="craft"
                          value={formData.craft}
                          onChange={handleChange}
                          placeholder="e.g. Director, Cinematographer, Writer"
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="location" className="text-sm font-medium">Location</label>
                        <Input
                          id="location"
                          name="location"
                          value={formData.location}
                          onChange={handleChange}
                          placeholder="e.g. Los Angeles, CA"
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor="website" className="text-sm font-medium">Website</label>
                        <Input
                          id="website"
                          name="website"
                          value={formData.website}
                          onChange={handleChange}
                          placeholder="https://yourwebsite.com"
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                      
                      <div className="space-y-2 md:col-span-2">
                        <label htmlFor="bio" className="text-sm font-medium">Bio</label>
                        <Textarea
                          id="bio"
                          name="bio"
                          value={formData.bio}
                          onChange={handleChange}
                          rows={3}
                          className="bg-cinesphere-dark/50 border-white/10"
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-3 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="border-white/20"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Bio</h3>
                      <p className="text-gray-300">{formData.bio}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center">
                        <MapPin size={18} className="text-cinesphere-purple mr-2" />
                        <span>{formData.location}</span>
                      </div>
                      
                      <div className="flex items-center">
                        <LinkIcon size={18} className="text-cinesphere-purple mr-2" />
                        <a 
                          href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cinesphere-purple hover:underline"
                        >
                          {formData.website}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="portfolio">
              <div className="space-y-6">
                {showPortfolioUpload ? (
                  <PortfolioUpload
                    onSuccess={() => {
                      setShowPortfolioUpload(false);
                      // Refresh portfolio grid
                    }}
                    onCancel={() => setShowPortfolioUpload(false)}
                  />
                ) : (
                  <PortfolioGrid
                    userId="temp-user-id"
                    isOwner={true}
                    onAddNew={() => setShowPortfolioUpload(true)}
                  />
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="watchlist">
              <div className="glass-card rounded-xl p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">My Movie Ratings</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {movieRatings.map(movie => (
                    <Card key={movie.title} className="bg-black/20 backdrop-blur-sm border-white/10">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg">{movie.title}</h3>
                          <span className="text-sm text-gray-400">{movie.type}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <StarRating 
                            title={movie.title}
                            type={movie.type}
                            initialRating={movie.rating} 
                            showValue 
                            size={20} 
                          />
                          <span className="text-sm text-gray-400">{movie.releaseDate}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {movieRatings.length === 0 && (
                  <div className="text-center py-10">
                    <Film className="h-16 w-16 mx-auto text-gray-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No ratings yet</h3>
                    <p className="text-gray-400 mb-4">Start rating movies to see them appear here</p>
                    <Button 
                      onClick={() => navigate("/explore")}
                      className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
                    >
                      Explore Movies
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
