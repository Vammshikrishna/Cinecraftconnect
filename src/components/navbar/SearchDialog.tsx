
import { useState } from "react";
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
import { Search, X } from "lucide-react";

interface SearchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const SearchDialog = ({ isOpen, onOpenChange }: SearchDialogProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // Mock search results
    if (query.length > 2) {
      setSearchResults([
        { id: 1, title: "Cinematography Tips", type: "project" },
        { id: 2, title: "Maya Chen", type: "user" },
        { id: 3, title: "Sci-fi Film Making", type: "craft" },
      ]);
    } else {
      setSearchResults([]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background/95 backdrop-blur-lg border-border">
        <DialogHeader>
          <DialogTitle>Search CineSphere</DialogTitle>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search for projects, people, or crafts..." 
            className="bg-muted/50 border-border focus:border-primary"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <Button variant="ghost" size="icon" onClick={() => handleSearch("")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Search Results</p>
            <div className="space-y-2">
              {searchResults.map((result) => (
                <div key={result.id} className="p-2 rounded hover:bg-muted cursor-pointer">
                  <span className="font-medium">{result.title}</span>
                  <Badge variant="outline" className="ml-2">{result.type}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" onClick={() => handleSearch("Cinematography")}>Cinematography</Badge>
            <Badge variant="secondary" onClick={() => handleSearch("Maya Chen")}>Maya Chen</Badge>
            <Badge variant="secondary" onClick={() => handleSearch("Sci-fi projects")}>Sci-fi projects</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SearchDialog;
