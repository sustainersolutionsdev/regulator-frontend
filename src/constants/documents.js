/**
 * Supporting documents: what may be uploaded (Srinivas, 9/17: PDF, Word,
 * Excel, text and PowerPoint, up to 25 MB each). The server checks the same
 * rules (core/storage.py); these give an instant message in the browser.
 */
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.pptx', '.ppt'];
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_RULES_TEXT = 'PDF, Word, Excel, PowerPoint or text · up to 25 MB each';

/** null when the file can be uploaded, otherwise the message to show. */
export function documentProblem(file) {
  const ext = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) return `"${file.name}": file type ${ext} is not allowed.`;
  if (file.size > MAX_DOCUMENT_BYTES) return `"${file.name}" is larger than 25 MB.`;
  return null;
}
