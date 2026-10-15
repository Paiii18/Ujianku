import { Badge } from "@/components/ui/badge";

export default function UserStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge className="bg-success text-success-foreground">Aktif</Badge>
  ) : (
    <Badge variant="outline">Nonaktif</Badge>
  );
}
