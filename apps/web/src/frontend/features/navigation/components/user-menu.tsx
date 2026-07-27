import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@lib/auth-client";

export type ShellUser = {
  name: string;
  email: string;
};

export function UserMenu({ user }: { user: ShellUser }) {
  const label = user.name.trim() || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-1.5 py-1 text-xs font-normal text-muted-foreground hover:text-foreground"
        >
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="font-normal text-xs">
            <Link to="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            className="font-normal text-xs"
            onClick={() => void authClient.signOut()}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
