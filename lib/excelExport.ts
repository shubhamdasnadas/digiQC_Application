import * as XLSX from 'xlsx-js-style';

export function exportToXlsx(rows: Record<string, any>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  if (rows.length > 0) {
    worksheet['!cols'] = Object.keys(rows[0]).map(key => ({
      wch: Math.max(12, key.length, ...rows.map(row => String(row[key] ?? '').length)),
    }));
  }

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToCsv(rows: Record<string, any>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
