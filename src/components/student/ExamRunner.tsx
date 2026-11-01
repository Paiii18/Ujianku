import { useCallback, useMemo, useState } from "react";
import Head from "next/head";
import { ChevronLeft, ChevronRight, Flag, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  initialAnswers,
  isAnswered,
  readRagu,
  writeRagu,
  type Answer,
  type Paper,
} from "@/lib/examPaper";
import ExamNumberPanel, { type NumberStatus } from "./ExamNumberPanel";
import ExamQuestion from "./ExamQuestion";
import ExamTimer from "./ExamTimer";

// Halaman pengerjaan (F3.8): satu soal per layar, panel nomor (samping ≥ md, sheet di HP),
// tanda ragu-ragu, timer dari deadline_at server.
// ponytail: jawaban baru di state browser; simpan ke server + antre offline di F3.9,
// fullscreen/pindah tab F3.10, kumpulkan F3.11.
export default function ExamRunner({
  paper,
  images,
  serverNow,
}: {
  paper: Paper;
  images: Record<string, string>;
  serverNow: number;
}) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState(() => initialAnswers(paper));
  // Dirender hanya di browser (lihat halaman attempt): localStorage & jam perangkat aman dibaca
  const [ragu, setRagu] = useState(() => readRagu(paper.attempt_id));
  const [offset] = useState(() => serverNow - Date.now());
  const [timeUp, setTimeUp] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const onExpire = useCallback(() => setTimeUp(true), []);
  const onAnswer = useCallback((id: string, answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: answer }));
  }, []);

  const questions = paper.questions;
  const q = questions[current];
  const statuses: NumberStatus[] = useMemo(
    () =>
      questions.map((x) =>
        ragu.includes(x.id)
          ? "ragu"
          : isAnswered(x, answers)
            ? "answered"
            : "empty",
      ),
    [questions, ragu, answers],
  );
  const isRagu = !!q && ragu.includes(q.id);

  function toggleRagu() {
    const next = isRagu ? ragu.filter((id) => id !== q.id) : [...ragu, q.id];
    setRagu(next);
    writeRagu(paper.attempt_id, next);
  }

  function go(index: number) {
    setCurrent(index);
    setPanelOpen(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="min-h-dvh bg-background">
      <Head>
        <title>{`${paper.title} · Ujianku`}</title>
      </Head>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate font-semibold">{paper.title}</h1>
          <p className="text-sm text-muted-foreground">
            Soal {current + 1} dari {questions.length}
          </p>
        </div>
        <ExamTimer
          deadline={paper.deadline_at}
          offset={offset}
          onExpire={onExpire}
        />
      </header>

      {timeUp && (
        <p
          role="alert"
          className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Waktu habis. Jawaban tidak bisa diubah lagi.
        </p>
      )}

      <main className="mx-auto flex max-w-5xl gap-8 px-4 pt-4 pb-28">
        <section className="min-w-0 flex-1">
          {q ? (
            <ExamQuestion
              key={q.id}
              question={q}
              number={current + 1}
              answers={answers}
              images={images}
              disabled={timeUp}
              onAnswer={onAnswer}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Ujian ini belum punya soal.
            </p>
          )}
        </section>
        <aside className="hidden w-60 shrink-0 md:block">
          <h2 className="mb-3 text-sm font-semibold">Nomor soal</h2>
          <ExamNumberPanel
            statuses={statuses}
            current={current}
            onSelect={go}
          />
        </aside>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t bg-card px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label="Soal sebelumnya"
          >
            <ChevronLeft aria-hidden />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Button>
          <Button
            variant="outline"
            className={
              isRagu
                ? "h-11 flex-1 border-warning bg-warning text-warning-foreground hover:bg-warning/90 sm:flex-none"
                : "h-11 flex-1 sm:flex-none"
            }
            aria-pressed={isRagu}
            onClick={toggleRagu}
            disabled={!q}
          >
            <Flag aria-hidden /> Ragu-ragu
          </Button>
          <Button
            variant="outline"
            className="h-11 md:hidden"
            onClick={() => setPanelOpen(true)}
            aria-label="Buka nomor soal"
          >
            <LayoutGrid aria-hidden />
          </Button>
          <Button
            className="ml-auto h-11"
            onClick={() => go(current + 1)}
            disabled={current >= questions.length - 1}
            aria-label="Soal berikutnya"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </footer>

      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent side="bottom" className="px-4 pb-6">
          <SheetTitle className="pt-4">Nomor soal</SheetTitle>
          <SheetDescription className="sr-only">
            Pilih nomor untuk berpindah soal
          </SheetDescription>
          <ExamNumberPanel
            statuses={statuses}
            current={current}
            onSelect={go}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
