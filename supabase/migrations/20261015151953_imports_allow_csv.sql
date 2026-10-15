-- F2.4 — Import murid juga menerima .csv (selain .xlsx).
update storage.buckets
set allowed_mime_types = array[
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/zip'
]
where id = 'imports';
