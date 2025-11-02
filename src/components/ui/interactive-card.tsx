import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
interface InteractiveCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "default" | "hover-lift" | "glow" | "gradient";
}
export function InteractiveCard({
  title,
  description,
  icon: Icon,
  children,
  className,
  onClick,
  variant = "default"
}: InteractiveCardProps) {
  const variants = {
    default: "transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
    "hover-lift": "transition-all duration-300 hover:shadow-xl hover:-translate-y-2 hover:scale-[1.02]",
    glow: "transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1",
    gradient: "bg-gradient-to-br from-card via-card to-primary/5 transition-all duration-300 hover:from-primary/5 hover:to-primary/10 hover:-translate-y-1"
  };
  return;
}