// Link WhatsApp ke pengelola Ujianku untuk perpanjangan langganan, dengan pesan siap kirim.
// Nomor dari env SUPPORT_WHATSAPP (format internasional tanpa +, misal 6281234567890).
// Panggil di server (getServerSideProps): env tanpa NEXT_PUBLIC_ tidak ada di browser.
// Belum diisi → null, tombol WhatsApp tidak ditampilkan.
export function renewWhatsAppLink(school: { code: string; name: string }) {
  const phone = process.env.SUPPORT_WHATSAPP?.replace(/\D/g, "");
  if (!phone) return null;
  const text = `Halo, saya Admin Sekolah ${school.name} (kode ${school.code}). Saya ingin memperpanjang langganan Ujianku.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
