import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ponytail: halaman contoh komponen shadcn (F0.2), diganti saat F1.5/F1.7
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            Ujianku <Badge variant="secondary">MVP</Badge>
          </CardTitle>
          <CardDescription>Platform ujian online sekolah</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="staf">
            <TabsList className="w-full">
              <TabsTrigger value="staf">Staf</TabsTrigger>
              <TabsTrigger value="murid">Murid</TabsTrigger>
            </TabsList>
            <TabsContent value="staf" className="mt-4">
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="guru@sekolah.sch.id"
                />
              </Field>
            </TabsContent>
            <TabsContent value="murid" className="mt-4">
              <Field>
                <FieldLabel htmlFor="nis">NIS</FieldLabel>
                <Input id="nis" inputMode="numeric" placeholder="12345" />
              </Field>
            </TabsContent>
          </Tabs>
          <Button
            className="mt-4 w-full"
            onClick={() => toast.success("Komponen shadcn berfungsi")}
          >
            Coba
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
