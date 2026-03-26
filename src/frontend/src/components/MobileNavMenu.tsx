import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Menu, MessageCircle, Newspaper, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MobileNavMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative flex md:hidden" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => setOpen((v) => !v)}
        data-ocid="nav.toggle"
        aria-label="Open navigation menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-border rounded-2xl shadow-lg py-2 z-50">
          <Link to="/lobby" onClick={() => setOpen(false)}>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
              Lobby
            </button>
          </Link>
          <Link to="/cards" onClick={() => setOpen(false)}>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Users className="h-4 w-4 text-muted-foreground" />
              Calling Cards
            </button>
          </Link>
          <Link to="/feed" onClick={() => setOpen(false)}>
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <Newspaper className="h-4 w-4 text-muted-foreground" />
              Feed
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
