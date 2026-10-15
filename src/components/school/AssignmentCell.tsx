import { useState } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/browser";

export type TeacherChoice = { id: string; fullName: string; isActive: boolean };
export type Assignment = { id: string; teacherId: string };

// Satu sel matriks (kelas × mapel): centang guru yang mengampu.
// Tiap centang langsung disimpan (satu INSERT/DELETE, tanpa tombol Simpan);
// RLS + FK komposit + trigger memastikan guru, mapel, dan kelas milik sekolah ini.
export default function AssignmentCell({
  classId,
  className,
  subjectId,
  subjectName,
  teachers,
  assigned,
}: {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teachers: TeacherChoice[];
  assigned: Assignment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const byTeacher = new Map(assigned.map((a) => [a.teacherId, a.id]));
  const names = teachers.filter((t) => byTeacher.has(t.id));
  // Guru nonaktif hanya tampil bila masih ditugaskan (agar bisa dilepas)
  const choices = teachers.filter((t) => t.isActive || byTeacher.has(t.id));

  async function toggle(teacherId: string) {
    setBusy(teacherId);
    const supabase = createClient();
    const assignmentId = byTeacher.get(teacherId);
    const { error } = assignmentId
      ? await supabase
          .from("teaching_assignments")
          .delete()
          .eq("id", assignmentId)
      : await supabase.from("teaching_assignments").insert({
          teacher_id: teacherId,
          subject_id: subjectId,
          class_id: classId,
        });
    if (error) toast.error("Gagal menyimpan. Coba lagi.");
    await router.replace(router.asPath, undefined, { scroll: false });
    setBusy(null);
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto min-h-11 w-full justify-start whitespace-normal px-2 text-left font-normal"
          aria-label={`Atur guru ${subjectName} di ${className}`}
        >
          {names.length ? (
            names.map((t) => t.fullName).join(", ")
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {subjectName} · {className}
          </DialogTitle>
          <DialogDescription>
            Centang guru yang mengampu. Perubahan langsung tersimpan.
          </DialogDescription>
        </DialogHeader>
        {choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada guru aktif. Tambah guru di menu Guru.
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {choices.map((t) => (
              <li key={t.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={byTeacher.has(t.id)}
                    disabled={busy !== null}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="text-sm">
                    {t.fullName}
                    {!t.isActive && (
                      <span className="text-muted-foreground"> (nonaktif)</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
