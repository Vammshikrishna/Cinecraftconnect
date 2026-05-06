import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
}

export const BackButton = ({ to, label = "BACK", className, onClick }: BackButtonProps) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to, { state: { noScroll: true } });
    } else {
      navigate(-1);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      className={cn(
        "rounded-full bg-muted/50 hover:bg-muted border border-border/50 text-foreground font-black uppercase tracking-widest px-6 h-10 transition-all hover:scale-105 active:scale-95",
        className
      )}
    >
      <ArrowLeft size={16} className="mr-2" />
      {label}
    </Button>
  );
};

export default BackButton;
