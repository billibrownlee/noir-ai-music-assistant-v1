import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, Sparkles, Settings, User, Bell, Search } from "lucide-react";

export default function StudioHeader() {
  return (
    <header className="border-b border-border/50 bg-gradient-glass backdrop-blur-md">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-neon">
                <Music className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full animate-pulse-neon"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">FugattoAI</h1>
              <p className="text-xs text-muted-foreground">Professional Music Generation</p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/50 text-primary">
            <Sparkles className="w-3 h-3 mr-1" />
            Studio Pro
          </Badge>
        </div>

        {/* Center Search */}
        <div className="hidden md:flex items-center gap-2 max-w-md flex-1 mx-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search prompts, templates, or tracks..."
              className="w-full pl-10 pr-4 py-2 bg-input/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full"></div>
          </Button>
          
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Settings</span>
          </Button>
          
          <Button variant="studio" size="sm">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Profile</span>
          </Button>
        </div>
      </div>
    </header>
  );
}