import { ChevronDown, LogOut } from "lucide-react";
import { useSignOut } from "@/components/auth/useSignOut";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL } from "@/lib/auth";
import type { SessionUser } from "@/lib/requireRole";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function UserMenu({ user }: { user: SessionUser }) {
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-2">
          <span
            className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
            aria-hidden
          >
            {initials(user.fullName)}
          </span>
          <span className="hidden max-w-40 truncate text-sm sm:inline">
            {user.fullName}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">Menu akun</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {ROLE_LABEL[user.role]}
            {user.schoolName && ` · ${user.schoolName}`}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut} className="h-10">
          <LogOut aria-hidden /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
