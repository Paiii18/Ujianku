import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ponytail: isi dashboard kosong (F1.7); diganti ringkasan nyata per peran (F1.11, F1.12, F3.x).
export default function EmptyDashboard({
  name,
  text,
}: {
  name: string;
  text: string;
}) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="font-heading text-xl">
          Selamat datang, {name.split(" ")[0]}
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
    </Card>
  );
}
