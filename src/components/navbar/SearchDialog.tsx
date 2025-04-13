
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface SearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SearchDialog = ({ isOpen, onOpenChange }: SearchDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
          <Search className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-cinesphere-dark/95 backdrop-blur-lg border-white/10">
        <DialogHeader>
          <DialogTitle>Search CineSphere</DialogTitle>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Search className="h-5 w-5 text-gray-400" />
          <Input 
            placeholder="Search for projects, people, or crafts..." 
            className="bg-white/5 border-white/10 focus:border-cinesphere-purple"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">Cinematography</Badge>
            <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">Maya Chen</Badge>
            <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">Sci-fi projects</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
