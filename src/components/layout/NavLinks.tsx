import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth";
import { NAV } from "./nav";

const itemClass =
  "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors";

// Dipakai di sidebar desktop dan drawer HP.
export default function NavLinks({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const { pathname } = useRouter();
  const items = NAV[role];
  const home = items[0].href;

  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1 p-3">
      {items.map(({ href, label, icon: Icon, soon }) => {
        if (soon) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className={cn(itemClass, "text-muted-foreground/70")}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
              <Badge variant="outline" className="ml-auto text-[0.65rem]">
                Segera
              </Badge>
            </span>
          );
        }
        // Dashboard aktif hanya di path persis; menu lain juga di sub-halamannya.
        const active =
          href === home ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              itemClass,
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
