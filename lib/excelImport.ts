import * as XLSX from 'xlsx-js-style';

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export interface ParsedRow {
  [key: string]: any;
}

export async function parseExcelFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ParsedRow[];
        resolve(jsonData);
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function bulkInsertWithChunking(
  insertFn: (rows: ParsedRow[]) => Promise<void>,
  rows: ParsedRow[],
  chunkSize: number = 100
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, failed: 0, errors: [] };
  const chunks = Math.ceil(rows.length / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, rows.length);
    const chunk = rows.slice(start, end);

    try {
      await insertFn(chunk);
      result.success += chunk.length;
    } catch (error) {
      for (let j = 0; j < chunk.length; j++) {
        result.failed++;
        result.errors.push({
          row: start + j + 2,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (i < chunks - 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  return result;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

export function sanitizeString(value: any): string {
  return String(value || '').trim();
}

export function parseNumber(value: any): number | null {
  const num = Number(value);
  return isNaN(num) ? null : num;
}

export function parseDate(value: any): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === 'y';
}
