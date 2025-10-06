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
  return <Button onClick={onClick} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className={cn(positions[position], sizes[size], variants[variant], "rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-50", className)}>
      <Icon className="h-6 w-6" />
      {label && isHovered}
    </Button>;
}