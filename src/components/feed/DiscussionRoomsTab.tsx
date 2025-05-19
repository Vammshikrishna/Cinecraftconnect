
import { Button } from "@/components/ui/button";
import DiscussionRoomCard from "./DiscussionRoomCard";

const DiscussionRoomsTab = () => {
  return (
    <div className="glass-card rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4 text-gradient">Discussion Rooms</h2>
      <p className="mb-6 text-gray-300">Connect with other filmmakers in virtual rooms to discuss projects, share ideas, and collaborate.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <DiscussionRoomCard 
          title="Indie Film Financing"
          description="Ongoing discussion about creative funding strategies for independent productions."
          memberCount={5}
          members={[
            { initials: "JD", color: "bg-cinesphere-purple/50" },
            { initials: "TS", color: "bg-cinesphere-blue/50" },
            { initials: "KL", color: "bg-cinesphere-purple/80" }
          ]}
          variant="purple"
        />
        
        <DiscussionRoomCard 
          title="Post-Production Workflow"
          description="Tips and tricks for optimizing your post-production pipeline."
          memberCount={8}
          members={[
            { initials: "AR", color: "bg-cinesphere-purple/50" },
            { initials: "MC", color: "bg-cinesphere-blue/50" },
            { initials: "+5", color: "bg-cinesphere-purple/80" }
          ]}
          variant="blue"
        />
      </div>
      
      <Button className="w-full bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90">
        Create New Discussion Room
      </Button>
    </div>
  );
};

export default DiscussionRoomsTab;
