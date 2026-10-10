import { PDFDocument, PDFFont, PDFPage, rgb, LineCapStyle } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { symbolFor } from "@/lib/currency-format";
import {
  FONT_FRANK_RUHL_600,
  FONT_SORA_400,
  FONT_SORA_600,
} from "@/lib/menu-pdf-fonts";

/**
 * src/lib/menu-pdf.ts
 *
 * গ্রাহকের "Download Menu" PDF — A4, একটা cover header (লোগো, ঠিকানা,
 * সময়, QR), তারপর শ্রেণি অনুযায়ী দুই-কলামের তালিকা, প্রতি পাতায় footer।
 *
 * ⚠️ এই ফাইলে কোনো database বা network নেই — কেবল `data` ঢুকলে PDF বাইট
 * বেরোয়। কারণ: (১) vitest-এ DB ছাড়াই যাচাই করা যায়, (২) কোন দাম/offer
 * দেখাবে সেই সিদ্ধান্ত route-এর, আঁকার যুক্তি এখানকার — দুটো গুলিয়ে গেলে
 * প্রতিবার ডিজাইন বদলাতে query-ও ছুঁতে হতো।
 *
 * ⚠️ ফন্ট: Sora + Frank Ruhl Libre (সাইটের ফন্ট), latin subset। তাই যে
 * অক্ষর ফন্টে নেই (বাংলা নাম, ৳ ₹ ইত্যাদি) সেটা কখনো সরাসরি আঁকা হয় না —
 * `clean()` ওগুলোকে "?" করে দেয়, আর মুদ্রার চিহ্ন না থাকলে `formatPrice()`
 * ISO কোডে ("BDT 105.00") নামে। না করলে pdf-lib encode করতে গিয়ে throw
 * করত, আর একটা পদের নামের জন্য পুরো মেনু ডাউনলোড বন্ধ হয়ে যেত।
 */

export type MenuPdfItem = {
  title: string;
  description: string;
  /** গ্রাহক যে দাম দিতে যাচ্ছে (offer থাকলে ছাড়ের পরের)। */
  price: number;
  /** offer থাকলে আসল দাম, নইলে null — strikethrough দেখাতে। */
  originalPrice: number | null;
  /** "20% OFF" ধরনের ছোট লেবেল। */
  badge: string | null;
  /** "Veg", "Spicy" … মুক্ত লেখা। */
  foodStatus: string | null;
  calories: number | null;
};

export type MenuPdfCategory = { name: string; items: MenuPdfItem[] };

export type MenuPdfData = {
  restaurantName: string;
  address: string;
  /** যেমন "10:00 AM – 10:00 PM"। */
  hoursLabel: string;
  /** ঐচ্ছিক — ফাঁকা হলে লাইনটাই আঁকা হয় না (placeholder নম্বর ছাপা হয় না)। */
  phone?: string;
  /** QR যেখানে নিয়ে যাবে (পুরো URL)। */
  qrUrl: string;
  /** QR-এর নিচে মানুষের পড়ার জন্য ছোট রূপ ("cuisine.com/menu")। */
  displayUrl: string;
  /** "October 10, 2026" — restaurant-এর timezone-এ। */
  generatedOn: string;
  currency: string;
  currencyMinorUnits: number;
  /** footer-এর কর-সংক্রান্ত লাইন; null হলে আঁকা হয় না। */
  taxNote: string | null;
  categories: MenuPdfCategory[];
};

/* ── ডিজাইন ───────────────────────────────────────────────────────── */

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 44;
const CONTENT_W = A4.w - MARGIN * 2;
const COL_GAP = 28;
const COL_W = (CONTENT_W - COL_GAP) / 2;

const COLOR = {
  ink: rgb(0.078, 0.098, 0.129), // #141921
  grey: rgb(0.36, 0.37, 0.4),
  mute: rgb(0.55, 0.56, 0.6),
  line: rgb(0.906, 0.886, 0.863), // #E7E2DC
  cream: rgb(0.976, 0.965, 0.953), // #F9F6F3
  orange: rgb(1, 0.584, 0.251), // #FF9540
  pink: rgb(1, 0.439, 0.776), // #FF70C6
  white: rgb(1, 1, 1),
};

const FOOTER_H = 46;
const BOTTOM_LIMIT = A4.h - FOOTER_H - 10; // top-based y; এর নিচে কিছু আঁকা চলবে না

type Fonts = { sora: PDFFont; soraBold: PDFFont; serif: PDFFont };

/* ── ছোট সহায়ক ──────────────────────────────────────────────────── */

const charsetCache = new WeakMap<PDFFont, Set<number>>();

function charsetOf(font: PDFFont): Set<number> {
  let set = charsetCache.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsetCache.set(font, set);
  }
  return set;
}

/**
 * ফন্টে যে অক্ষর নেই সেটা "?" বানায়, আর ফাঁকা-জাতীয় সবকিছু একটা space।
 * ⚠️ export করা — test এটা সরাসরি যাচাই করে।
 */
export function clean(text: string, font: PDFFont): string {
  const set = charsetOf(font);
  let out = "";
  for (const ch of text.normalize("NFC").replace(/\s+/g, " ")) {
    const cp = ch.codePointAt(0)!;
    out += set.has(cp) ? ch : "?";
  }
  return out.trim();
}

/** চিহ্ন ফন্টে আঁকা গেলে চিহ্ন ("$8.99"), নইলে ISO কোড ("BDT 105.00")। */
export function formatPrice(
  value: number,
  currency: string,
  minorUnits: number,
  font: PDFFont
): string {
  const num = value.toFixed(minorUnits);
  const symbol = symbolFor(currency);
  if (symbol && [...symbol].every((ch) => charsetOf(font).has(ch.codePointAt(0)!))) {
    return `${symbol}${num}`;
  }
  return `${clean(currency, font)} ${num}`;
}

/** শব্দ ধরে ভাঙে; maxWidth-এর চেয়ে লম্বা একক শব্দ হলে অক্ষরে ভাঙে। */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = () => {
    if (line) lines.push(line);
    line = "";
  };

  for (const word of text.split(" ").filter(Boolean)) {
    let w = word;
    while (font.widthOfTextAtSize(w, size) > maxWidth) {
      // একটা শব্দই লাইনের চেয়ে লম্বা: যতটা ধরে ততটা কেটে নেওয়া।
      push();
      let cut = w.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      push();
      line = w;
    }
  }
  push();
  return lines;
}

/** সর্বোচ্চ `max` লাইন; বেশি হলে শেষ লাইনে "…" (ফন্টে না থাকলে "...")। */
function clamp(lines: string[], max: number, font: PDFFont, size: number, width: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  const ellipsis = charsetOf(font).has(0x2026) ? "\u2026" : "...";
  let last = kept[max - 1];
  while (last.length > 1 && font.widthOfTextAtSize(last + ellipsis, size) > width) {
    last = last.slice(0, -1);
  }
  kept[max - 1] = last.trimEnd() + ellipsis;
  return kept;
}

/** গোল-কোণা আয়তক্ষেত্র — pdf-lib-এ radius নেই, তাই SVG path। (x, y) = উপরের-বাঁ, top-based। */
function roundedRect(
  page: PDFPage,
  x: number,
  top: number,
  w: number,
  h: number,
  r: number,
  opts: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; strokeWidth?: number }
) {
  const path =
    `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} ` +
    `H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  page.drawSvgPath(path, {
    x,
    y: A4.h - top,
    color: opts.fill,
    borderColor: opts.stroke,
    borderWidth: opts.strokeWidth ?? 0,
  });
}

/** ফাঁক-ফাঁক অক্ষরের ছোট label ("ADDRESS")। */
function spaced(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  tracking = 1.2
) {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y: A4.h - top, size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

/** কমলা→গোলাপি gradient; pdf-lib-এ gradient নেই, তাই সরু ফালির সারি। */
function gradientBar(page: PDFPage, top: number, height: number) {
  const steps = 72;
  const sw = A4.w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    page.drawRectangle({
      x: i * sw,
      y: A4.h - top - height,
      width: sw + 0.6, // সামান্য overlap — নইলে ফালির মাঝে সাদা সুতো দেখা যায়
      height,
      color: rgb(
        COLOR.orange.red + (COLOR.pink.red - COLOR.orange.red) * t,
        COLOR.orange.green + (COLOR.pink.green - COLOR.orange.green) * t,
        COLOR.orange.blue + (COLOR.pink.blue - COLOR.orange.blue) * t
      ),
    });
  }
}

/** QR-কে vector বর্গ হিসেবে আঁকা — ছবি নয়, তাই যত বড় করে ছাপাই ধার ধারালো। */
function drawQr(page: PDFPage, text: string, x: number, top: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c)) continue;
      page.drawRectangle({
        x: x + c * cell,
        y: A4.h - top - (r + 1) * cell,
        width: cell + 0.15,
        height: cell + 0.15,
        color: COLOR.ink,
      });
    }
  }
}

/* ── মূল কাজ ─────────────────────────────────────────────────────── */

export async function buildMenuPdf(data: MenuPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // ⚠️ subset: true (ডিফল্ট) থাকতেই হবে। ফন্টগুলো WOFF; `subset: false` দিলে pdf-lib
  // WOFF-এর কাঁচা বাইটই PDF-এ বসায়, আর PDF-এর FontFile2 কেবল TrueType নেয় — Poppler/Preview
  // তখন "Embedded font file may be invalid" বলে লেখা আঁকেই না। subset করলে fontkit
  // নিজে একটা বৈধ TrueType বানিয়ে দেয়।
  const fonts: Fonts = {
    sora: await pdf.embedFont(FONT_SORA_400, { subset: true }),
    soraBold: await pdf.embedFont(FONT_SORA_600, { subset: true }),
    serif: await pdf.embedFont(FONT_FRANK_RUHL_600, { subset: true }),
  };

  const name = clean(data.restaurantName, fonts.serif) || "Menu";
  pdf.setTitle(`${name} Menu`);
  pdf.setAuthor(name);
  pdf.setSubject(`Menu as of ${data.generatedOn}`);
  pdf.setCreator(name);
  pdf.setProducer(name);
  pdf.setCreationDate(new Date());

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0; // top-based, নিচে বাড়ে

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    pages.push(page);
    if (pages.length === 1) {
      y = drawCover(page, data, fonts, name);
    } else {
      gradientBar(page, 0, 4);
      page.drawText(name, {
        x: MARGIN,
        y: A4.h - 38,
        size: 15,
        font: fonts.serif,
        color: COLOR.ink,
      });
      const tag = "Menu";
      page.drawText(tag, {
        x: A4.w - MARGIN - fonts.sora.widthOfTextAtSize(tag, 9),
        y: A4.h - 37,
        size: 9,
        font: fonts.sora,
        color: COLOR.mute,
      });
      page.drawLine({
        start: { x: MARGIN, y: A4.h - 52 },
        end: { x: A4.w - MARGIN, y: A4.h - 52 },
        thickness: 0.6,
        color: COLOR.line,
      });
      y = 78;
    }
  };

  newPage();

  const HEADING_H = 40;
  const ROW_GAP = 16;

  for (const category of data.categories) {
    if (category.items.length === 0) continue;

    // প্রতিটা সারির উচ্চতা আগেই মাপা — না মাপলে পাতার তলায় গিয়ে কাটা পড়ত।
    const blocks = category.items.map((item) => layoutItem(item, data, fonts));
    const rows: (typeof blocks)[] = [];
    for (let i = 0; i < blocks.length; i += 2) rows.push(blocks.slice(i, i + 2));
    const rowHeight = (row: typeof blocks) => Math.max(...row.map((b) => b.height));

    // শিরোনামের পর অন্তত প্রথম সারিটা না আঁটলে নতুন পাতা — শিরোনাম একা তলায় পড়ে থাকবে না।
    if (y + HEADING_H + rowHeight(rows[0]) > BOTTOM_LIMIT) newPage();

    drawCategoryHeading(page, clean(category.name, fonts.serif) || "Menu", y, fonts);
    y += HEADING_H;

    for (const row of rows) {
      const h = rowHeight(row);
      if (y + h > BOTTOM_LIMIT) {
        newPage();
        // নতুন পাতায় শ্রেণির নাম আবার ছোট করে, যাতে পাতাটা একা পড়লে বোঝা যায় কীসের তালিকা।
        page.drawText(`${clean(category.name, fonts.serif)} (cont.)`, {
          x: MARGIN,
          y: A4.h - y - 9,
          size: 10,
          font: fonts.soraBold,
          color: COLOR.orange,
        });
        y += 24;
      }
      row.forEach((block, col) => {
        block.draw(page, MARGIN + col * (COL_W + COL_GAP), y);
      });
      y += h + ROW_GAP;
    }
    y += 10; // শ্রেণির মধ্যে বাড়তি ফাঁক
  }

  // footer সবার শেষে — তখনই "Page n of N"-এর N জানা।
  pages.forEach((p, i) => drawFooter(p, data, fonts, name, i + 1, pages.length));

  return pdf.save();
}

/* ── cover (শুধু পাতা ১) ─────────────────────────────────────────── */

/** আঁকা শেষে পরের কনটেন্ট কোন top-y থেকে শুরু হবে সেটা ফেরত দেয়। */
function drawCover(page: PDFPage, data: MenuPdfData, f: Fonts, name: string): number {
  const PANEL_H = 286;
  page.drawRectangle({
    x: 0,
    y: A4.h - PANEL_H,
    width: A4.w,
    height: PANEL_H,
    color: COLOR.cream,
  });
  gradientBar(page, 0, 6);

  // লোগো: গোল কমলা চিহ্ন + নাম।
  page.drawCircle({ x: MARGIN + 14, y: A4.h - 52, size: 14, color: COLOR.orange });
  const initial = (name[0] ?? "C").toUpperCase();
  page.drawText(initial, {
    x: MARGIN + 14 - f.serif.widthOfTextAtSize(initial, 17) / 2,
    y: A4.h - 58,
    size: 17,
    font: f.serif,
    color: COLOR.white,
  });
  page.drawText(name, { x: MARGIN + 38, y: A4.h - 58, size: 22, font: f.serif, color: COLOR.ink });

  spaced(page, "THE MENU", MARGIN, 108, f.soraBold, 8, COLOR.orange, 2);

  page.drawText("Fresh, fast &", {
    x: MARGIN,
    y: A4.h - 142,
    size: 40,
    font: f.serif,
    color: COLOR.ink,
  });
  page.drawText("full of flavor.", {
    x: MARGIN,
    y: A4.h - 184,
    size: 40,
    font: f.serif,
    color: COLOR.ink,
  });

  const sub = wrap(
    "Freshly prepared meals from our kitchen to your table, or right to your doorstep.",
    f.sora,
    10,
    290
  );
  sub.forEach((line, i) =>
    page.drawText(line, {
      x: MARGIN,
      y: A4.h - 208 - i * 15,
      size: 10,
      font: f.sora,
      color: COLOR.grey,
    })
  );

  // QR কার্ড (ডানে)।
  const CARD_W = 138;
  const CARD_H = 172;
  const cardX = A4.w - MARGIN - CARD_W;
  const cardTop = 40;
  roundedRect(page, cardX, cardTop, CARD_W, CARD_H, 16, {
    fill: COLOR.white,
    stroke: COLOR.line,
    strokeWidth: 0.8,
  });
  const QR = 100;
  drawQr(page, data.qrUrl, cardX + (CARD_W - QR) / 2, cardTop + 16, QR);
  const cap = "Scan to order online";
  page.drawText(cap, {
    x: cardX + (CARD_W - f.soraBold.widthOfTextAtSize(cap, 8.5)) / 2,
    y: A4.h - (cardTop + 16 + QR + 20),
    size: 8.5,
    font: f.soraBold,
    color: COLOR.ink,
  });
  const url = clean(data.displayUrl, f.sora);
  const urlSize = Math.min(7.5, (CARD_W - 16) / Math.max(1, f.sora.widthOfTextAtSize(url, 1)));
  page.drawText(url, {
    x: cardX + (CARD_W - f.sora.widthOfTextAtSize(url, urlSize)) / 2,
    y: A4.h - (cardTop + 16 + QR + 34),
    size: urlSize,
    font: f.sora,
    color: COLOR.mute,
  });

  // নিচের তথ্য-সারি: ঠিকানা · সময় · (ফোন)।
  const infos: { label: string; value: string }[] = [
    { label: "ADDRESS", value: clean(data.address, f.sora) },
    { label: "KITCHEN HOURS", value: `Daily, ${clean(data.hoursLabel, f.sora)}` },
  ];
  if (data.phone?.trim()) infos.push({ label: "CALL US", value: clean(data.phone, f.sora) });

  const infoW = (CONTENT_W - 24 * (infos.length - 1)) / infos.length;
  infos.forEach((info, i) => {
    const x = MARGIN + i * (infoW + 24);
    spaced(page, info.label, x, 250, f.soraBold, 6.5, COLOR.orange, 1.4);
    wrap(info.value, f.sora, 9, infoW)
      .slice(0, 2)
      .forEach((line, li) =>
        page.drawText(line, {
          x,
          y: A4.h - 264 - li * 12,
          size: 9,
          font: f.sora,
          color: COLOR.ink,
        })
      );
  });

  return PANEL_H + 34;
}

/* ── শ্রেণির শিরোনাম ─────────────────────────────────────────────── */

function drawCategoryHeading(page: PDFPage, text: string, top: number, f: Fonts) {
  const size = 21;
  page.drawText(text, { x: MARGIN, y: A4.h - top - size + 3, size, font: f.serif, color: COLOR.ink });
  const w = f.serif.widthOfTextAtSize(text, size);
  page.drawCircle({ x: MARGIN + w + 9, y: A4.h - top - size + 8, size: 2.4, color: COLOR.orange });
  page.drawLine({
    start: { x: MARGIN + w + 20, y: A4.h - top - size + 8 },
    end: { x: A4.w - MARGIN, y: A4.h - top - size + 8 },
    thickness: 0.6,
    color: COLOR.line,
  });
}

/* ── একটা পদ ─────────────────────────────────────────────────────── */

type ItemBlock = { height: number; draw: (page: PDFPage, x: number, top: number) => void };

function layoutItem(item: MenuPdfItem, data: MenuPdfData, f: Fonts): ItemBlock {
  const TITLE = 10.5;
  const DESC = 8;
  const META = 7;

  const priceText = formatPrice(item.price, data.currency, data.currencyMinorUnits, f.soraBold);
  const oldText =
    item.originalPrice !== null
      ? formatPrice(item.originalPrice, data.currency, data.currencyMinorUnits, f.sora)
      : null;

  const priceW = f.soraBold.widthOfTextAtSize(priceText, TITLE);
  const oldW = oldText ? f.sora.widthOfTextAtSize(oldText, 8) + 6 : 0;
  const rightBlockW = priceW + oldW;

  const title = clean(item.title, f.soraBold) || "Untitled";
  // শিরোনাম দাম পর্যন্ত গড়াতে পারে না — ১২pt ফাঁক রেখে ভাঙে, সর্বোচ্চ দুই লাইন।
  const titleLines = clamp(
    wrap(title, f.soraBold, TITLE, COL_W - rightBlockW - 12),
    2,
    f.soraBold,
    TITLE,
    COL_W - rightBlockW - 12
  );

  const descLines = clamp(
    wrap(clean(item.description, f.sora), f.sora, DESC, COL_W),
    3,
    f.sora,
    DESC,
    COL_W
  );

  const metaParts: string[] = [];
  if (item.foodStatus?.trim()) metaParts.push(clean(item.foodStatus, f.sora));
  if (item.calories !== null && item.calories > 0) metaParts.push(`${item.calories} kcal`);
  const meta = metaParts.join("  \u00B7  ");
  const badge = item.badge ? clean(item.badge, f.soraBold) : "";
  const hasMeta = Boolean(meta || badge);

  const height =
    titleLines.length * 14 + (descLines.length ? descLines.length * 11.5 + 2 : 0) + (hasMeta ? 12 : 0);

  return {
    height,
    draw(page, x, top) {
      // শিরোনাম।
      titleLines.forEach((line, i) =>
        page.drawText(line, {
          x,
          y: A4.h - top - TITLE - i * 14 + 2,
          size: TITLE,
          font: f.soraBold,
          color: COLOR.ink,
        })
      );

      // দাম — ডানে লাগানো, প্রথম লাইনের সারিতে।
      const baseY = A4.h - top - TITLE + 2;
      const priceX = x + COL_W - priceW;
      page.drawText(priceText, {
        x: priceX,
        y: baseY,
        size: TITLE,
        font: f.soraBold,
        color: oldText ? COLOR.orange : COLOR.ink,
      });
      if (oldText) {
        const ox = priceX - oldW;
        page.drawText(oldText, { x: ox, y: baseY, size: 8, font: f.sora, color: COLOR.mute });
        const ow = f.sora.widthOfTextAtSize(oldText, 8);
        page.drawLine({
          start: { x: ox - 0.5, y: baseY + 2.8 },
          end: { x: ox + ow + 0.5, y: baseY + 2.8 },
          thickness: 0.7,
          color: COLOR.mute,
        });
      }

      // বিন্দু-বিন্দু leader — শুধু একলাইনের শিরোনামে, নইলে দুই লাইনের মাঝখানে অদ্ভুত দেখায়।
      if (titleLines.length === 1) {
        const lead0 = x + f.soraBold.widthOfTextAtSize(titleLines[0], TITLE) + 6;
        const lead1 = x + COL_W - rightBlockW - 6;
        if (lead1 - lead0 > 14) {
          page.drawLine({
            start: { x: lead0, y: baseY + 0.4 },
            end: { x: lead1, y: baseY + 0.4 },
            thickness: 1,
            color: rgb(0.78, 0.76, 0.73),
            dashArray: [0.1, 3.2],
            lineCap: LineCapStyle.Round,
          });
        }
      }

      // বর্ণনা।
      const descTop = top + titleLines.length * 14;
      descLines.forEach((line, i) =>
        page.drawText(line, {
          x,
          y: A4.h - descTop - DESC - i * 11.5 + 1,
          size: DESC,
          font: f.sora,
          color: COLOR.grey,
        })
      );

      // meta: offer লেবেল (কমলা) + ধরন/ক্যালরি (ধূসর)।
      if (hasMeta) {
        const metaTop = descTop + (descLines.length ? descLines.length * 11.5 + 2 : 0);
        const my = A4.h - metaTop - META - 2;
        let mx = x;
        if (badge) {
          page.drawText(badge, { x: mx, y: my, size: META, font: f.soraBold, color: COLOR.orange });
          mx += f.soraBold.widthOfTextAtSize(badge, META) + (meta ? 8 : 0);
        }
        if (meta) page.drawText(meta, { x: mx, y: my, size: META, font: f.sora, color: COLOR.mute });
      }
    },
  };
}

/* ── footer ──────────────────────────────────────────────────────── */

function drawFooter(
  page: PDFPage,
  data: MenuPdfData,
  f: Fonts,
  name: string,
  n: number,
  total: number
) {
  const lineY = A4.h - (A4.h - FOOTER_H + 4);
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: A4.w - MARGIN, y: lineY },
    thickness: 0.6,
    color: COLOR.line,
  });

  const pageLabel = `Page ${n} of ${total}`;
  page.drawText(pageLabel, {
    x: A4.w - MARGIN - f.sora.widthOfTextAtSize(pageLabel, 7.5),
    y: lineY - 14,
    size: 7.5,
    font: f.sora,
    color: COLOR.mute,
  });

  const leftMax = CONTENT_W - f.sora.widthOfTextAtSize(pageLabel, 7.5) - 16;
  const left = clamp(
    wrap(`${name}  \u00B7  ${clean(data.address, f.sora)}`, f.sora, 7.5, leftMax),
    1,
    f.sora,
    7.5,
    leftMax
  );
  page.drawText(left[0] ?? name, { x: MARGIN, y: lineY - 14, size: 7.5, font: f.sora, color: COLOR.mute });

  const note = [`Prices as of ${data.generatedOn}`, data.taxNote].filter(Boolean).join("  \u00B7  ");
  const noteLines = clamp(wrap(clean(note, f.sora), f.sora, 7, CONTENT_W), 1, f.sora, 7, CONTENT_W);
  page.drawText(noteLines[0] ?? "", {
    x: MARGIN,
    y: lineY - 25,
    size: 7,
    font: f.sora,
    color: COLOR.mute,
  });
}
