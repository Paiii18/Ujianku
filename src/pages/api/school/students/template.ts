import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiRole } from "@/lib/apiAuth";
import { activeYearClasses } from "@/lib/activeYearClasses";
import { buildStudentTemplate, studentCsvTemplate } from "@/lib/studentImport";

// GET: unduh template import murid. ?format=csv → CSV (header + contoh),
// selain itu .xlsx berisi juga daftar kelas tahun ajaran aktif.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const supabase = await requireApiRole(req, res, "GET", "school_admin");
  if (!supabase) return;

  const classes = await activeYearClasses(supabase);
  const classNames = [...classes.values()].map((c) => c.name);
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="template-import-murid.csv"',
    );
    return res.status(200).send(studentCsvTemplate(classNames[0]));
  }
  const file = buildStudentTemplate(classNames);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="template-import-murid.xlsx"',
  );
  return res.status(200).send(file);
}
