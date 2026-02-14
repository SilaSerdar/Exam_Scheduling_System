import PDFDocument from "pdfkit";

export type TimetableEvent = {
  dayOfWeek: number; // 0=Mon..6=Sun
  startMinuteOfDay: number; // minutes since 00:00
  endMinuteOfDay: number; // minutes since 00:00
  text: string; // multi-line text to show in cell
};

export type TimetableDay = {
  dayOfWeek: number;
  label: string; // "PAZARTESİ\n05.01.2026" or "Pzt"
};

export async function renderTimetablePdf(params: {
  headerLines: string[]; // centered lines at the top
  days: TimetableDay[]; // order matters
  startHour: number; // e.g. 9
  endHour: number; // e.g. 18 (exclusive)
  events: TimetableEvent[];
}): Promise<Uint8Array> {
  const { headerLines, days, startHour, endHour, events } = params;

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 24 });
  const chunks: Uint8Array[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Uint8Array>((resolve, reject) => {
    doc.on("end", () => resolve(concat(chunks)));
    doc.on("error", reject);
  });

  const pageLeft = doc.page.margins.left;
  const pageTop = doc.page.margins.top;
  const pageRight = doc.page.width - doc.page.margins.right;

  // Header box
  const headerHeight = 70;
  doc.rect(pageLeft, pageTop, pageRight - pageLeft, headerHeight).strokeColor("#000").lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(10);
  const headerText = toAsciiText(headerLines.filter(Boolean).join("\n"));
  drawCenteredText(doc, headerText, pageLeft + 10, pageTop + 8, pageRight - pageLeft - 20, headerHeight - 16, 10, true);

  // Table geometry
  const tableTop = pageTop + headerHeight;
  const tableLeft = pageLeft;
  const tableWidth = pageRight - pageLeft;

  const dayColWidth = 92;
  const hourCount = Math.max(1, endHour - startHour);
  const colWidth = (tableWidth - dayColWidth) / hourCount;
  const headerRowHeight = 26;
  const rowHeight = 70;

  // Table border
  const tableHeight = headerRowHeight + days.length * rowHeight;
  doc.rect(tableLeft, tableTop, tableWidth, tableHeight).strokeColor("#000").lineWidth(1).stroke();

  // Header row cells
  doc.font("Helvetica-Bold").fontSize(8);
  // day header cell (blank)
  doc.rect(tableLeft, tableTop, dayColWidth, headerRowHeight).stroke();
  for (let i = 0; i < hourCount; i++) {
    const x = tableLeft + dayColWidth + i * colWidth;
    doc.rect(x, tableTop, colWidth, headerRowHeight).stroke();
    const label = `${pad2(startHour + i)}:00-${pad2(startHour + i + 1)}:00`;
    drawCenteredText(doc, label, x + 2, tableTop + 3, colWidth - 4, headerRowHeight - 6, 8, true);
  }

  // Events lookup by day + startHourIndex
  const eventsByDay = new Map<number, TimetableEvent[]>();
  for (const e of events) {
    const arr = eventsByDay.get(e.dayOfWeek) ?? [];
    arr.push(e);
    eventsByDay.set(e.dayOfWeek, arr);
  }
  for (const [d, arr] of eventsByDay) {
    arr.sort((a, b) => a.startMinuteOfDay - b.startMinuteOfDay);
    eventsByDay.set(d, arr);
  }

  doc.font("Helvetica").fontSize(7.5);

  for (let r = 0; r < days.length; r++) {
    const day = days[r]!;
    const y = tableTop + headerRowHeight + r * rowHeight;

    // Day label cell
    doc.rect(tableLeft, y, dayColWidth, rowHeight).stroke();
    doc.font("Helvetica-Bold").fontSize(7.5);
    drawCenteredText(doc, toAsciiText(day.label), tableLeft + 4, y + 4, dayColWidth - 8, rowHeight - 8, 7.5, true);
    doc.font("Helvetica").fontSize(7.2);

    const dayEvents = eventsByDay.get(day.dayOfWeek) ?? [];
    const startMinute = startHour * 60;

    // Map events that start at whole-hour boundaries we display
    const startMap = new Map<number, TimetableEvent>();
    for (const e of dayEvents) {
      const idx = Math.floor((e.startMinuteOfDay - startMinute) / 60);
      if (idx < 0 || idx >= hourCount) continue;
      // only consider whole-hour starts in the grid
      if (e.startMinuteOfDay % 60 !== 0) continue;
      startMap.set(idx, e);
    }

    for (let c = 0; c < hourCount; ) {
      const x = tableLeft + dayColWidth + c * colWidth;
      const e = startMap.get(c);
      if (e) {
        const spanHours = Math.max(
          1,
          Math.ceil((e.endMinuteOfDay - e.startMinuteOfDay) / 60)
        );
        const span = Math.min(spanHours, hourCount - c);
        const w = span * colWidth;
        doc.rect(x, y, w, rowHeight).stroke();
        drawCenteredText(doc, toAsciiText(e.text), x + 3, y + 4, w - 6, rowHeight - 8, 7.2, false);
        c += span;
      } else {
        doc.rect(x, y, colWidth, rowHeight).stroke();
        c += 1;
      }
    }
  }

  doc.end();
  return await done;
}

function concat(chunks: Uint8Array[]) {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function drawCenteredText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  bold: boolean
) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
  const t = (text ?? "").toString();
  const textHeight = doc.heightOfString(t, { width: w, align: "center" });
  const yy = y + Math.max(0, (h - textHeight) / 2);
  doc.text(t, x, yy, { width: w, align: "center" });
}

function toAsciiText(input: string) {
  // PDFKit built-in fonts are not Unicode; normalize Turkish chars to ASCII to prevent mojibake.
  const map: Record<string, string> = {
    ı: "i",
    İ: "I",
    ş: "s",
    Ş: "S",
    ğ: "g",
    Ğ: "G",
    ü: "u",
    Ü: "U",
    ö: "o",
    Ö: "O",
    ç: "c",
    Ç: "C",
  };

  const replaced = (input ?? "")
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");

  // Keep newlines; replace other non-ASCII with space.
  return replaced
    .replace(/[^\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

