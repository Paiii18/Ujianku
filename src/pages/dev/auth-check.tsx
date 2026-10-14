import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import { createClient as createBrowserClient } from "@/lib/supabase/browser";
import { createClient as createServerClient } from "@/lib/supabase/server";

// ponytail: halaman uji F0.4, hapus setelah login (F1.5) jadi.
type Props = { serverEmail: string | null };

export const getServerSideProps: GetServerSideProps<Props> = async ({
  req,
  res,
}) => {
  const supabase = createServerClient(req, res);
  const { data } = await supabase.auth.getUser();
  return { props: { serverEmail: data.user?.email ?? null } };
};

export default function AuthCheck({ serverEmail }: Props) {
  const [clientEmail, setClientEmail] = useState<string | null>();

  useEffect(() => {
    createBrowserClient()
      .auth.getUser()
      .then(({ data }) => setClientEmail(data.user?.email ?? null));
  }, []);

  return (
    <main className="space-y-2 p-4 font-mono text-sm">
      <p>Server (getServerSideProps): {serverEmail ?? "belum login"}</p>
      <p>
        Client (browser):{" "}
        {clientEmail === undefined
          ? "memuat..."
          : (clientEmail ?? "belum login")}
      </p>
    </main>
  );
}
