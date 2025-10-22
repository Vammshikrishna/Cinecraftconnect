import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { useState } from "react";
interface FloatingActionButtonProps {
  icon: LucideIcon;
  onClick: () => void;
  label?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  size?: "sm" | "md" | "lg";
  variant?: "default" | "primary" | "secondary";
  className?: string;
}
export function FloatingActionButton({
  icon: Icon,
  onClick,
  label,
  position = "bottom-right",
  size = "md",
  variant = "primary",
  className
}: FloatingActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const positions = {
    "bottom-right": "fixed bottom-6 right-6",
    "bottom-left": "fixed bottom-6 left-6",
    "top-right": "fixed top-6 right-6",
    "top-left": "fixed top-6 left-6"
  };
  const sizes = {
    sm: "h-12 w-12",
    md: "h-14 w-14",
    lg: "h-16 w-16"
  };
  const variants = {
    default: "bg-card border-border hover:bg-accent",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90"
  };
  return <div className={cn(positions[position], "z-50")} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      
      {label && isHovered && <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-popover text-popover-foreground rounded-md shadow-lg whitespace-nowrap text-sm">
          {label}
        </div>}
    </div>;
}