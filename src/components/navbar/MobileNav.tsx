
import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-4 left-4 z-50 rounded-full bg-cinesphere-dark shadow-lg border border-white/10 md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[80%] bg-cinesphere-dark border-r border-white/10 p-0">
        <nav className="flex flex-col p-4">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive mb-2"
          >
            Home
          </Link>
          <Link
            to="/feed"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive mb-2"
          >
            Feed
          </Link>
          <Link
            to="/projects"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive mb-2"
          >
            Projects
          </Link>
          <Link
            to="/jobs"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive mb-2"
          >
            Jobs
          </Link>
          <Link
            to="/network"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive mb-2"
          >
            Network
          </Link>
          <Link
            to="/learn"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive"
          >
            Learn
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
