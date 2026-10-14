import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RenewWhatsAppButton({ href }: { href: string }) {
  return (
    <Button asChild className="h-11">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden /> Perpanjang via WhatsApp
      </a>
    </Button>
  );
}
