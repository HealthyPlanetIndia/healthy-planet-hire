import mammoth from "mammoth";

export async function extractText(file) {
  const { mimetype: type, buffer: buf, originalname: name } = file;
  if (type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return pdfText(buf);
  if (type.includes("wordprocessingml") || name.toLowerCase().endsWith(".docx")) return (await mammoth.extractRawText({ buffer: buf })).value;
  return buf.toString("utf8");
}

async function pdfText(buf) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let line = "", lastY = null;
    for (const it of content.items) { if (lastY !== null && Math.abs(it.transform[5] - lastY) > 2) { line += "\n"; } line += it.str + (it.hasEOL ? "\n" : " "); lastY = it.transform[5]; }
    pages.push(line);
  }
  const text = pages.join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 40) throw new Error("This PDF has no readable text (it may be a scan). Paste the resume text instead.");
  return text;
}
