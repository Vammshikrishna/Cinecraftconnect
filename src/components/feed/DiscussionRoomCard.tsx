
import { Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface DiscussionRoomProps {
  title: string;
  description: string;
  memberCount: number;
  members: Array<{ initials: string; color: string }>;
  variant?: 'purple' | 'blue';
}

const DiscussionRoomCard = ({ 
  title, 
  description, 
  memberCount, 
  members, 
  variant = 'purple' 
}: DiscussionRoomProps) => {
  return (
    <div 
      className={`border border-white/10 rounded-lg p-4 bg-gradient-to-b from-black/40 
        ${variant === 'purple' 
          ? 'to-cinesphere-purple/10 hover:from-black/30 hover:to-cinesphere-purple/20' 
          : 'to-cinesphere-blue/10 hover:from-black/30 hover:to-cinesphere-blue/20'} 
        transition-all cursor-pointer`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold">{title}</h3>
        <div 
          className={`${variant === 'purple' ? 'bg-cinesphere-purple/30' : 'bg-cinesphere-blue/30'} 
            px-2 py-1 rounded text-xs`}
        >
          {memberCount} members
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      <div className="flex justify-between items-center">
        <div className="flex -space-x-2">
          {members.map((member, index) => (
            <Avatar key={index} className="h-6 w-6 border border-black">
              <AvatarFallback className={`${member.color} text-xs`}>{member.initials}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="flex space-x-2">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
            <Mic size={16} />
          </Button>
          <Button size="sm" variant="default" className="h-8 px-3 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue">
            <Video size={16} className="mr-1" />
            Join
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DiscussionRoomCard;
