import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatCountdown } from "@/lib/examPaper";
import { cn } from "@/lib/utils";

// Sisa waktu dari deadline_at server. offset = jam server − jam perangkat (jam HP bisa melenceng).
// Komponen sendiri agar tick tiap detik tidak me-render ulang soal.
export default function ExamTimer({
  deadline,
  offset,
  onExpire,
}: {
  deadline: string;
  offset: number;
  onExpire: () => void;
}) {
  const end = new Date(deadline).getTime();
  const [left, setLeft] = useState<number | null>(null); // null sampai mount (hindari hydration mismatch)

  useEffect(() => {
    const tick = () => {
      const ms = end - (Date.now() + offset);
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(timer);
        onExpire();
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [end, offset, onExpire]);

  const low = left !== null && left < 5 * 60 * 1000;
  return (
    <p
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-lg tabular-nums",
        low && "bg-destructive/10 text-destructive",
      )}
    >
      <Clock className="size-4" aria-hidden />
      <span className="sr-only">Sisa waktu </span>
      {left === null ? "--:--" : formatCountdown(left)}
    </p>
  );
}
