import type { GetServerSideProps } from "next";
import Head from "next/head";
import { CalendarX, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/components/auth/useSignOut";
import RenewWhatsAppButton from "@/components/school/RenewWhatsAppButton";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { renewWhatsAppLink } from "@/lib/whatsapp";

type Props = {
  schoolName: string;
  activeUntil: string | null;
  isSchoolAdmin: boolean;
  whatsappHref: string | null;
};

// Proxy sudah memastikan hanya user sekolah nonaktif yang sampai di sini.
// Nama sekolah lewat RPC my_school() karena RLS menyembunyikan tenants saat nonaktif.
export const getServerSideProps: GetServerSideProps<Props> = async ({
  req,
  res,
}) => {
  const toLogin = { redirect: { destination: "/login", permanent: false } };
  const supabase = createClient(req, res);
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return toLogin;

  const [{ data: access }, { data: school }] = await Promise.all([
    supabase.rpc("my_access").maybeSingle(),
    supabase.rpc("my_school").maybeSingle(),
  ]);
  if (!access || !school) return toLogin;

  const isSchoolAdmin = access.role === "school_admin";
  return {
    props: {
      schoolName: school.name,
      activeUntil: school.active_until,
      isSchoolAdmin,
      whatsappHref: isSchoolAdmin ? renewWhatsAppLink(school) : null,
    },
  };
};

export default function SubscriptionExpiredPage({
  schoolName,
  activeUntil,
  isSchoolAdmin,
  whatsappHref,
}: Props) {
  const signOut = useSignOut();

  return (
    <>
      <Head>
        <title>Langganan berakhir · Ujianku</title>
      </Head>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <CalendarX className="size-12 text-warning" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">
            {schoolName}
          </p>
          <h1 className="font-heading text-2xl font-semibold">
            Langganan sekolah berakhir
          </h1>
        </div>
        <p className="max-w-sm text-muted-foreground">
          {activeUntil && <>Masa aktif berakhir {formatDate(activeUntil)}. </>}
          Akses sementara dinonaktifkan. Data tetap tersimpan dan bisa dipakai
          lagi setelah langganan diperpanjang.
        </p>
        <p className="max-w-sm text-sm">
          {isSchoolAdmin
            ? "Hubungi pengelola Ujianku untuk memperpanjang langganan."
            : "Hubungi admin sekolah Anda untuk perpanjangan."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {whatsappHref && <RenewWhatsAppButton href={whatsappHref} />}
          <Button variant="outline" className="h-11" onClick={signOut}>
            <LogOut aria-hidden /> Keluar
          </Button>
        </div>
      </main>
    </>
  );
}
