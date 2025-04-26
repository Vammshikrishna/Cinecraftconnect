
import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed bottom-4 left-4 z-50 rounded-full bg-cinesphere-dark shadow-lg border border-white/10 md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-cinesphere-dark border-t border-white/10">
        <nav className="flex flex-col items-center p-6 space-y-4">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive w-full text-center"
          >
            Home
          </Link>
          <Link
            to="/feed"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive w-full text-center"
          >
            Feed
          </Link>
          <Link
            to="/projects"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive w-full text-center"
          >
            Projects
          </Link>
          <Link
            to="/jobs"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive w-full text-center"
          >
            Jobs
          </Link>
          <Link
            to="/network"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive w-full text-center"
          >
            Network
          </Link>
          <Link
            to="/learn"
            onClick={() => setOpen(false)}
            className="nav-item nav-item-inactive w-full text-center"
          >
            Learn
          </Link>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
