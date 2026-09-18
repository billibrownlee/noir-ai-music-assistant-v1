import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthButton } from "@/components/ui/auth-button";
import { Sparkles, Settings, Bell, Search } from "lucide-react";
import noirLogo from "@/assets/noir-logo.png";

export default function StudioHeader() {
  return (
    <header className="relative border-b border-border/40 bg-card/80 backdrop-blur-xl">
      {/* Orange accent gradient line at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          <div className="relative">
            <img
              src={noirLogo}
              alt="Noir"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-neon"
            />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-background animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">Noir</h1>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex h-5 px-1.5 text-[10px] font-semibold tracking-wider border-primary/40 text-primary bg-primary/5"
              >
                <Sparkles className="w-2.5 h-2.5 mr-1" />
                STUDIO PRO
              </Badge>
            </div>
            <p className="hidden sm:block text-[11px] text-muted-foreground leading-none mt-0.5">
              AI Music Production
            </p>
          </div>
        </div>

        {/* Center Search */}
        <div className="hidden md:flex flex-1 max-w-sm mx-6 lg:mx-10">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search samples, templates..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-background/60 border border-border/50 rounded-lg placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="relative w-8 h-8 sm:w-9 sm:h-9 text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex w-9 h-9 text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
          </Button>

          <div className="w-px h-5 bg-border/50 hidden sm:block mx-0.5" />

          <AuthButton />
        </div>
      </div>
    </header>
  );
}
