import { useState, type ReactNode } from "react";
import Head from "next/head";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { SessionUser } from "@/lib/requireRole";
import Brand from "./Brand";
import NavLinks from "./NavLinks";
import UserMenu from "./UserMenu";

// Kerangka halaman setelah login: sidebar (≥ md) / drawer (HP), header, konten.
export default function AppShell({
  user,
  title,
  children,
}: {
  user: SessionUser;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebarHeader = (
    <div className="border-b px-4 py-4">
      <Brand />
      {user.schoolName && (
        <p className="mt-2 truncate text-sm text-muted-foreground">
          {user.schoolName}
        </p>
      )}
    </div>
  );

  return (
    <>
      <Head>
        <title>{`${title} · Ujianku`}</title>
      </Head>
      <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r bg-sidebar md:flex">
          {sidebarHeader}
          <NavLinks role={user.role} />
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur md:px-6">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:hidden"
                >
                  <Menu aria-hidden />
                  <span className="sr-only">Buka menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Navigasi utama Ujianku
                </SheetDescription>
                {sidebarHeader}
                <NavLinks role={user.role} onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <h1 className="truncate text-base font-semibold md:text-lg">
              {title}
            </h1>
            <div className="ml-auto">
              <UserMenu user={user} />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </>
  );
}
