import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiRole } from "@/lib/apiAuth";
import { buildQuestionTemplate } from "@/lib/questionImport";

// GET: unduh template import soal (.xlsx) berisi contoh tiap tipe + daftar mapel sekolah.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const supabase = await requireApiRole(req, res, "GET", "teacher");
  if (!supabase) return;

  const { data: subjects } = await supabase
    .from("subjects")
    .select("code, name")
    .order("code");
  const file = buildQuestionTemplate(subjects ?? []);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="template-import-soal.xlsx"',
  );
  return res.status(200).send(file);
}
