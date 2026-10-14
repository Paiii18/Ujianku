import type { IncomingMessage, ServerResponse } from "http";
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr";
import type { Database } from "@/types/database";

// Dipakai di getServerSideProps dan API Route. Buat baru per request, jangan disimpan global.
// Bertindak sebagai user yang login (publishable key + cookie sesi), jadi RLS tetap berlaku.
export function createClient(req: IncomingMessage, res: ServerResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(req.headers.cookie ?? "").map(
            ({ name, value }) => ({ name, value: value ?? "" }),
          );
        },
        setAll(cookiesToSet, headers) {
          res.setHeader(
            "Set-Cookie",
            cookiesToSet.map(({ name, value, options }) =>
              serializeCookieHeader(name, value, options),
            ),
          );
          for (const [key, value] of Object.entries(headers)) {
            res.setHeader(key, value);
          }
        },
      },
    },
  );
}
