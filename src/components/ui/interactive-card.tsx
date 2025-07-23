import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface InteractiveCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  children?: React.ReactNode
  className?: string
  onClick?: () => void
  variant?: "default" | "hover-lift" | "glow" | "gradient"
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
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer border-border/50 hover:border-primary/50",
        variants[variant],
        onClick && "active:scale-95",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="p-2 rounded-lg bg-primary/10 text-primary transition-colors duration-300">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-foreground transition-colors duration-300">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      {children && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  )
}