
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Film, Camera, PenTool, Music, Scissors } from "lucide-react";

interface CraftFilter {
  name: string;
  icon: React.ReactNode | null;
  active: boolean;
}

const craftFilters: CraftFilter[] = [
  { name: "All", icon: null, active: true },
  { name: "Directing", icon: <Film size={16} />, active: false },
  { name: "Cinematography", icon: <Camera size={16} />, active: false },
  { name: "Writing", icon: <PenTool size={16} />, active: false },
  { name: "Sound", icon: <Music size={16} />, active: false },
  { name: "Editing", icon: <Scissors size={16} />, active: false }
];

interface CraftFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const CraftFilters = ({ activeFilter, onFilterChange }: CraftFiltersProps) => {
  return (
    <div className="mb-8 overflow-x-auto">
      <div className="flex space-x-2 min-w-max">
        {craftFilters.map((filter) => (
          <Button
            key={filter.name}
            variant={filter.name === activeFilter ? "default" : "outline"}
            className={`px-4 py-2 rounded-full ${
              filter.name === activeFilter 
                ? "bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue hover:from-cinesphere-purple/90 hover:to-cinesphere-blue/90" 
                : "border-white/20 hover:bg-white/5"
            }`}
            onClick={() => onFilterChange(filter.name)}
          >
            <div className="flex items-center">
              {filter.icon && <span className="mr-2">{filter.icon}</span>}
              <span>{filter.name}</span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default CraftFilters;
