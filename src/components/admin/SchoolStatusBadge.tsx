import { Badge } from "@/components/ui/badge";

// `active` dihitung di server: status 'active' DAN active_until belum lewat (sama dengan tenant_is_active()).
export default function SchoolStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-success text-success-foreground">Aktif</Badge>
  ) : (
    <Badge variant="destructive">Nonaktif</Badge>
  );
}
