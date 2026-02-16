import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface PageText {
  pageNumber: number;
  text: string;
}

export async function extractTextWithPages(file: File): Promise<PageText[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: PageText[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    pages.push({ pageNumber: i, text: pageText });
  }

  return pages;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pages = await extractTextWithPages(file);
  return pages.map(p => p.text).join('\n');
}