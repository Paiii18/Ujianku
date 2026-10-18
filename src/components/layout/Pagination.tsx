import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Navigasi halaman sebelumnya/berikutnya untuk daftar dengan pagination server (?page=).
// ponytail: halaman murid & sekolah masih memakai PageLink lokal; pindahkan ke sini bila disentuh.
export default function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Halaman" className="flex items-center justify-end gap-2">
      <span className="mr-2 text-sm text-muted-foreground">
        Halaman {page} dari {pages}
      </span>
      <PageLink href={href(page - 1)} disabled={page <= 1} label="Sebelumnya">
        <ChevronLeft aria-hidden />
      </PageLink>
      <PageLink
        href={href(page + 1)}
        disabled={page >= pages}
        label="Berikutnya"
      >
        <ChevronRight aria-hidden />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="icon" className="size-11" disabled>
        {children}
        <span className="sr-only">{label}</span>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" className="size-11" asChild>
      <Link href={href}>
        {children}
        <span className="sr-only">{label}</span>
      </Link>
    </Button>
  );
}
