import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Lexend, Source_Sans_3 } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

// Di-host sendiri oleh Next saat build (tidak ada request ke Google saat runtime).
const display = Lexend({ subsets: ["latin"] });
const body = Source_Sans_3({ subsets: ["latin"] });

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      {/* Variabel di <html> agar ikut ke portal (dialog, toast) di luar wrapper halaman */}
      <style jsx global>{`
        html {
          --font-display: ${display.style.fontFamily};
          --font-body: ${body.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
      <Toaster richColors position="top-center" />
    </>
  );
}
