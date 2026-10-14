// Zona waktu tetap agar hasil server (gSSP) dan browser sama (tidak ada hydration mismatch).
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export function formatDate(value: string | null) {
  return value ? dateFmt.format(new Date(value)) : "—";
}

const rupiahFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number) {
  return rupiahFmt.format(value);
}
