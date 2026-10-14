import { CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import RenewWhatsAppButton from "./RenewWhatsAppButton";

// Sisa masa aktif untuk Admin Sekolah. ≤ 7 hari ditandai warna peringatan (sejalan pengingat H-7).
export default function SubscriptionCard({
  activeUntil,
  daysLeft,
  whatsappHref,
}: {
  activeUntil: string;
  daysLeft: number;
  whatsappHref: string | null;
}) {
  const soon = daysLeft <= 7;

  return (
    <Card
      className={`max-w-2xl ${soon ? "border-warning ring-1 ring-warning" : ""}`}
    >
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden /> Masa aktif langganan
        </CardDescription>
        <CardTitle className="font-heading text-2xl">
          {daysLeft < 1 ? "Berakhir hari ini" : `Sisa ${daysLeft} hari`}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Aktif sampai {formatDate(activeUntil)}.{" "}
          {soon &&
            "Perpanjang sebelum berakhir agar guru dan murid tetap bisa memakai aplikasi."}
        </p>
        {soon && whatsappHref && (
          <div>
            <RenewWhatsAppButton href={whatsappHref} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
