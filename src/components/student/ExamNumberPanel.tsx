import { cn } from "@/lib/utils";

export type NumberStatus = "answered" | "ragu" | "empty";

const STYLE: Record<NumberStatus, string> = {
  answered: "border-success bg-success text-success-foreground",
  ragu: "border-warning bg-warning text-warning-foreground",
  empty: "bg-card",
};
const LABEL: Record<NumberStatus, string> = {
  answered: "terjawab",
  ragu: "ragu-ragu",
  empty: "belum dijawab",
};

// Panel nomor soal: hijau terjawab, kuning ragu-ragu (menang atas terjawab), putih kosong.
export default function ExamNumberPanel({
  statuses,
  current,
  onSelect,
}: {
  statuses: NumberStatus[];
  current: number;
  onSelect: (index: number) => void;
}) {
  const count = (s: NumberStatus) => statuses.filter((x) => x === s).length;
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Nomor soal" className="grid grid-cols-5 gap-2">
        {statuses.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={i === current ? "step" : undefined}
            aria-label={`Soal ${i + 1}, ${LABEL[s]}`}
            className={cn(
              "flex size-11 items-center justify-center rounded-md border text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              STYLE[s],
              i === current && "ring-2 ring-primary ring-offset-2",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>
      <ul className="flex flex-col gap-1 text-sm">
        {(["answered", "ragu", "empty"] as const).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn("size-4 rounded border", STYLE[s])}
              aria-hidden
            />
            <span className="first-letter:uppercase">{LABEL[s]}</span>
            <span className="ml-auto tabular-nums">{count(s)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
