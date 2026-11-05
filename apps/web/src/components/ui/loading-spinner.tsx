
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12", 
    lg: "h-20 w-20"
  };

  return (
    <div className={cn("flex items-center justify-center", className)} role="status" aria-live="polite">
      <img loading="lazy" decoding="async" 
        src="/logo-192.png"
        alt=""
        className={cn("animate-logo-motion object-contain rounded-full", sizeClasses[size])}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
};
