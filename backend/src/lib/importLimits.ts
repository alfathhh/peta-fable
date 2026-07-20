import { badRequest } from '../middlewares/errorHandler';

export const MAX_IMPORT_SHEETS = 5;
export const MAX_IMPORT_ROWS = 5000;

export function assertWorkbookShape(sheetCount: number, rowCount: number): void {
  if (sheetCount > MAX_IMPORT_SHEETS) throw badRequest(`Workbook maksimal ${MAX_IMPORT_SHEETS} sheet`);
  if (rowCount > MAX_IMPORT_ROWS) throw badRequest(`Import maksimal ${MAX_IMPORT_ROWS} baris`);
}
