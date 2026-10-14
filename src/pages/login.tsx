import Head from "next/head";
import { useRouter } from "next/router";
import StaffLoginForm from "@/components/auth/StaffLoginForm";
import StudentLoginForm from "@/components/auth/StudentLoginForm";
import Brand from "@/components/layout/Brand";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  // Diisi proxy saat akun dinonaktifkan admin sekolah.
  const disabled = useRouter().query.error === "nonaktif";

  return (
    <>
      <Head>
        <title>Masuk · Ujianku</title>
      </Head>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
        <Brand large />

        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Masuk</CardTitle>
            <CardDescription>
              Murid masuk dengan kode sekolah dan NIS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {disabled && (
              <p
                role="alert"
                className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                Akun Anda dinonaktifkan. Hubungi admin sekolah.
              </p>
            )}
            {/* Murid default: pengguna terbanyak */}
            <Tabs defaultValue="murid">
              <TabsList className="mb-4 w-full">
                <TabsTrigger value="murid">Murid</TabsTrigger>
                <TabsTrigger value="staf">Guru / Staf</TabsTrigger>
              </TabsList>
              <TabsContent value="murid">
                <StudentLoginForm />
              </TabsContent>
              <TabsContent value="staf">
                <StaffLoginForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Lupa password? Hubungi admin sekolah Anda.
        </p>
      </main>
    </>
  );
}
