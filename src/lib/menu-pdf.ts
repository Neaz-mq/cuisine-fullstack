import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  LineCapStyle,
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from "pdf-lib";
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
 * গ্রাহকের "Download Menu" PDF — poster-ধাঁচের রেস্তোরাঁ মেনু, A4:
 *
 *   • গাঢ় (#141921) পটভূমি, কমলা (#FF9540) আর গোলাপি (#FF70C6) — সাইটের রঙ
 *   • প্রতিটা শ্রেণি = কমলা pill-লেবেল + পদের তালিকা, আর উল্টো পাশে কমলা
 *     "band"-এ বসা গোল খাবারের ছবি (পাতার কিনারা পর্যন্ত গড়ানো), পাশ বদলাতে বদলাতে
 *   • ছবি না থাকলে (বা আনা না গেলে) শ্রেণিটা ছবিহীন দুই-কলামে আঁকা হয়
 *   • প্রতি পাতার তলায় ঠিকানা/সময়ের pill, পাতা নম্বর, দাম-কর লাইন
 *
 * ⚠️ এই ফাইলে কোনো database বা network নেই — কেবল `data` (ছবির বাইটসহ) ঢুকলে
 * PDF বাইট বেরোয়। ছবি আনা `menu-pdf-photos.ts`-এর কাজ, কোন দাম/offer যাবে সেটা
 * route-এর; আঁকার যুক্তি এখানে। না আলাদা করলে ডিজাইন বদলাতে query-ও ছুঁতে হতো,
 * আর test-এ DB/network লাগত।
 *
 * ⚠️ ফন্ট: Sora + Frank Ruhl Libre (সাইটের ফন্ট), latin subset। যে অক্ষর ফন্টে
 * নেই (বাংলা নাম, ৳ ₹ ইত্যাদি) সেটা কখনো সরাসরি আঁকা হয় না — `clean()` "?" করে
 * দেয়, আর মুদ্রার চিহ্ন না থাকলে `formatPrice()` ISO কোডে ("BDT 105.00") নামে।
 * না করলে pdf-lib encode করতে গিয়ে throw করত, আর একটা পদের নামের জন্য পুরো
 * মেনু ডাউনলোড বন্ধ হয়ে যেত।
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

export type MenuPdfCategory = {
  name: string;
  items: MenuPdfItem[];
  /** JPEG বাইট, সর্বোচ্চ ২টা ব্যবহার হয়। খালি/না থাকলে ছবিহীন নকশা। */
  photos?: Uint8Array[];
};

export type MenuPdfData = {
  restaurantName: string;
  address: string;
  /** যেমন "10:00 AM – 10:00 PM"। */
  hoursLabel: string;
  /** ঐচ্ছিক — ফাঁকা হলে pill-টাই আঁকা হয় না (placeholder নম্বর ছাপা হয় না)। */
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
const MARGIN = 40;
const CONTENT_W = A4.w - MARGIN * 2;
const COL_GAP = 26;
const COL_W = (CONTENT_W - COL_GAP) / 2;

const COLOR = {
  bg: rgb(0.078, 0.098, 0.129), // #141921 — সাইটের শিরোনামের কালো
  white: rgb(1, 1, 1),
  soft: rgb(0.76, 0.77, 0.8), // বর্ণনা
  mute: rgb(0.55, 0.57, 0.62), // meta, footer
  dots: rgb(0.34, 0.37, 0.43), // leader বিন্দু
  card: rgb(0.11, 0.13, 0.17), // পটভূমির চেয়ে সামান্য হালকা
  orange: rgb(1, 0.584, 0.251), // #FF9540
  pink: rgb(1, 0.439, 0.776), // #FF70C6
};

const FOOTER_TOP = A4.h - 64; // top-based; footer এখান থেকে শুরু
const BOTTOM_LIMIT = FOOTER_TOP - 14; // এর নিচে কনটেন্ট আঁকা চলবে না

// ছবির বৃত্ত: ring (কমলা) ঘিরে photo; band পাতার কিনারা পর্যন্ত।
const RING_R = 88;
const PHOTO_R = RING_R - 5;
const PHOTO_GAP = 24;
const LIST_W = CONTENT_W - RING_R * 2 - PHOTO_GAP;
const FEATURE_MIN_H = RING_R * 2 + 12;

const PILL_H = 22;
const AFTER_PILL = 18;
const ITEM_GAP = 14;
const SECTION_GAP = 30;

type Fonts = { sora: PDFFont; soraBold: PDFFont; serif: PDFFont };
type Rgb = ReturnType<typeof rgb>;

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

/** top-based y -> PDF y। */
const Y = (top: number) => A4.h - top;

/** গোল-কোণা আয়তক্ষেত্র — pdf-lib-এ radius নেই, তাই SVG path। (x, top) = উপরের-বাঁ। */
function roundedRect(
  page: PDFPage,
  x: number,
  top: number,
  w: number,
  h: number,
  r: number,
  opts: { fill?: Rgb; stroke?: Rgb; strokeWidth?: number }
) {
  const rr = Math.min(r, w / 2, h / 2);
  const path =
    `M ${rr} 0 H ${w - rr} Q ${w} 0 ${w} ${rr} V ${h - rr} Q ${w} ${h} ${w - rr} ${h} ` +
    `H ${rr} Q 0 ${h} 0 ${h - rr} V ${rr} Q 0 0 ${rr} 0 Z`;
  page.drawSvgPath(path, {
    x,
    y: Y(top),
    color: opts.fill,
    borderColor: opts.stroke,
    borderWidth: opts.strokeWidth ?? 0,
  });
}

function spacedWidth(text: string, font: PDFFont, size: number, tracking: number): number {
  let w = 0;
  for (const ch of text) w += font.widthOfTextAtSize(ch, size) + tracking;
  return Math.max(0, w - tracking);
}

/** ফাঁক-ফাঁক অক্ষরের লেখা ("THE MENU")। baselineTop = baseline-এর top-based y। */
function spaced(
  page: PDFPage,
  text: string,
  x: number,
  baselineTop: number,
  font: PDFFont,
  size: number,
  color: Rgb,
  tracking = 1.2
) {
  let cx = x;
  for (const ch of text) {
    page.drawText(ch, { x: cx, y: Y(baselineTop), size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

/** pill: কমলা ভরাট (লেবেল) বা শুধু ধার (তথ্য)। চওড়া ফেরত দেয়। */
function pill(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  font: PDFFont,
  opts: {
    h?: number;
    size: number;
    padX?: number;
    tracking?: number;
    fill?: Rgb;
    stroke?: Rgb;
    color: Rgb;
    radius?: number;
  }
): number {
  const h = opts.h ?? PILL_H;
  const padX = opts.padX ?? 12;
  const tracking = opts.tracking ?? 0;
  const textW = tracking ? spacedWidth(text, font, opts.size, tracking) : font.widthOfTextAtSize(text, opts.size);
  const w = textW + padX * 2;
  roundedRect(page, x, top, w, h, opts.radius ?? 6, {
    fill: opts.fill,
    stroke: opts.stroke,
    strokeWidth: opts.stroke ? 1 : 0,
  });
  const baseline = top + h / 2 + opts.size * 0.35;
  if (tracking) spaced(page, text, x + padX, baseline, font, opts.size, opts.color, tracking);
  else page.drawText(text, { x: x + padX, y: Y(baseline), size: opts.size, font, color: opts.color });
  return w;
}

/** কমলা→গোলাপি gradient; pdf-lib-এ gradient নেই, তাই সরু ফালির সারি। */
function gradientBar(page: PDFPage, top: number, height: number) {
  const steps = 72;
  const sw = A4.w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    page.drawRectangle({
      x: i * sw,
      y: Y(top) - height,
      width: sw + 0.6, // সামান্য overlap — নইলে ফালির মাঝে সুতো দেখা যায়
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
        y: Y(top) - (r + 1) * cell,
        width: cell + 0.15,
        height: cell + 0.15,
        color: COLOR.bg,
      });
    }
  }
}

/** ছবি বৃত্তে কেটে বসানো ("cover": বৃত্ত ভরে, মাপ বিকৃত হয় না)। */
function drawCirclePhoto(page: PDFPage, img: PDFImage, cx: number, cyTop: number, r: number) {
  const x = cx;
  const y = Y(cyTop);
  const k = 0.5522847498 * r;
  page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y),
    appendBezierCurve(x + r, y + k, x + k, y + r, x, y + r),
    appendBezierCurve(x - k, y + r, x - r, y + k, x - r, y),
    appendBezierCurve(x - r, y - k, x - k, y - r, x, y - r),
    appendBezierCurve(x + k, y - r, x + r, y - k, x + r, y),
    closePath(),
    clip(),
    endPath()
  );
  const scale = Math.max((r * 2) / img.width, (r * 2) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  page.drawImage(img, { x: x - w / 2, y: y - h / 2, width: w, height: h });
  page.pushOperators(popGraphicsState());
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
    page.drawRectangle({ x: 0, y: 0, width: A4.w, height: A4.h, color: COLOR.bg });
    if (pages.length === 1) {
      y = drawCover(page, data, fonts, name);
    } else {
      gradientBar(page, 0, 4);
      page.drawCircle({ x: MARGIN + 6, y: Y(40), size: 6, color: COLOR.orange });
      page.drawText(name, { x: MARGIN + 20, y: Y(46), size: 16, font: fonts.serif, color: COLOR.white });
      const tag = "MENU";
      spaced(
        page,
        tag,
        A4.w - MARGIN - spacedWidth(tag, fonts.soraBold, 7.5, 2),
        44,
        fonts.soraBold,
        7.5,
        COLOR.mute,
        2
      );
      y = 76;
    }
  };

  newPage();

  /** পাতার শুরুতে বা ভাঙার পরে আঁকা লেবেল-pill; y এগিয়ে দেয় না। */
  const drawLabel = (text: string, small = false) =>
    pill(page, text.toUpperCase(), MARGIN, y, fonts.soraBold, {
      size: small ? 8.5 : 10,
      h: small ? 20 : PILL_H,
      tracking: 1.1,
      fill: COLOR.orange,
      color: COLOR.bg,
    });

  /**
   * ছবিহীন (বা ছবির পরের বাকি) পদ: pill + পূর্ণ-চওড়া দুই-কলাম সারি।
   * পাতায় না আঁটলে নতুন পাতায় "(CONT.)" pill নিয়ে চলে।
   */
  const flowPlain = (label: string, items: MenuPdfItem[], started: boolean) => {
    const blocks = items.map((item) => layoutItem(item, data, fonts, COL_W));
    const rows: (typeof blocks)[] = [];
    for (let i = 0; i < blocks.length; i += 2) rows.push(blocks.slice(i, i + 2));
    const rowH = (row: typeof blocks) => Math.max(...row.map((b) => b.height));

    let labelText = label;
    if (y + PILL_H + AFTER_PILL + rowH(rows[0]) > BOTTOM_LIMIT) {
      newPage();
      labelText = started ? `${label} (cont.)` : label;
    }
    drawLabel(labelText, started);
    y += PILL_H + AFTER_PILL;

    for (const row of rows) {
      const h = rowH(row);
      if (y + h > BOTTOM_LIMIT) {
        newPage();
        drawLabel(`${label} (cont.)`, true);
        y += 20 + AFTER_PILL - 2;
      }
      row.forEach((block, col) => block.draw(page, MARGIN + col * (COL_W + COL_GAP), y));
      y += h + ITEM_GAP + 2;
    }
    y += SECTION_GAP - ITEM_GAP;
  };

  let featureIndex = 0;

  for (const category of data.categories) {
    if (category.items.length === 0) continue;
    const label = clean(category.name, fonts.soraBold) || "Menu";

    // ছবি বসানো — ভাঙা/অচেনা বাইট হলে ওই ছবিটা বাদ, PDF থামে না।
    const photos: PDFImage[] = [];
    for (const bytes of (category.photos ?? []).slice(0, 2)) {
      try {
        photos.push(await pdf.embedJpg(bytes));
      } catch {
        /* বাদ */
      }
    }

    if (photos.length === 0) {
      flowPlain(label, category.items, false);
      continue;
    }

    // ── ছবিসহ "feature" অংশ ──────────────────────────────────────
    const side: "right" | "left" = featureIndex++ % 2 === 0 ? "right" : "left";
    const blocks = category.items.map((item) => layoutItem(item, data, fonts, LIST_W));

    // ছবির বৃত্ত + অন্তত প্রথম পদটা না আঁটলে নতুন পাতা।
    const minNeeded = Math.max(FEATURE_MIN_H, PILL_H + AFTER_PILL + blocks[0].height);
    if (y + minNeeded > BOTTOM_LIMIT) newPage();

    const avail = BOTTOM_LIMIT - y;
    let used = PILL_H + AFTER_PILL;
    let count = 0;
    while (count < blocks.length) {
      const next = used + blocks[count].height + (count > 0 ? ITEM_GAP : 0);
      if (next > avail && count > 0) break;
      used = next;
      count++;
    }
    // একলা পদ পরের পাতায় ঝুলে থাকবে না — শেষ আঁটা পদটাও সাথে নিয়ে গিয়ে অন্তত জোড়া বানানো।
    if (category.items.length - count === 1 && count > 1) {
      used -= blocks[count - 1].height + ITEM_GAP;
      count--;
    }
    const listH = used;
    const regionH = Math.max(listH, FEATURE_MIN_H);
    const listTop = y + (regionH - listH) / 2; // তালিকা ছবির চেয়ে ছোট হলে মাঝখানে

    // band + ring + ছবি (আগে আঁকতে হবে, লেখা উপরে বসবে)।
    const cyTop = y + regionH / 2;
    const cx = side === "right" ? A4.w - MARGIN - RING_R - 4 : MARGIN + RING_R + 4;
    const bandH = RING_R * 1.62;
    const bandX = side === "right" ? cx : 0;
    const bandW = side === "right" ? A4.w - cx : cx;
    page.drawRectangle({ x: bandX, y: Y(cyTop) - bandH / 2, width: bandW, height: bandH, color: COLOR.orange });
    page.drawCircle({ x: cx, y: Y(cyTop), size: RING_R, color: COLOR.orange });
    drawCirclePhoto(page, photos[0], cx, cyTop, PHOTO_R);

    if (photos[1]) {
      // ছোট দ্বিতীয় বৃত্ত: নিচের ভেতরের কোণে, পটভূমির রঙের ধার দিয়ে আলাদা করা।
      const sr = 44;
      const sx = side === "right" ? cx + RING_R * 0.5 : cx - RING_R * 0.5;
      const sTop = cyTop + RING_R * 0.82;
      page.drawCircle({ x: sx, y: Y(sTop), size: sr + 5, color: COLOR.bg });
      page.drawCircle({ x: sx, y: Y(sTop), size: sr + 2, color: COLOR.pink });
      drawCirclePhoto(page, photos[1], sx, sTop, sr);
    }

    // তালিকা: ছবির উল্টো পাশে।
    const listX = side === "right" ? MARGIN : A4.w - MARGIN - LIST_W;
    pill(page, label.toUpperCase(), listX, listTop, fonts.soraBold, {
      size: 10,
      tracking: 1.1,
      fill: COLOR.orange,
      color: COLOR.bg,
    });
    let iy = listTop + PILL_H + AFTER_PILL;
    for (let i = 0; i < count; i++) {
      blocks[i].draw(page, listX, iy);
      iy += blocks[i].height + ITEM_GAP;
    }

    y += regionH + SECTION_GAP;

    // বাকি পদ (খুব লম্বা শ্রেণি) — পরের পাতায় ছবিহীন সারিতে।
    if (count < category.items.length) {
      flowPlain(label, category.items.slice(count), true);
    }
  }

  // footer সবার শেষে — তখনই "n / N"-এর N জানা।
  pages.forEach((p, i) => drawFooter(p, data, fonts, i + 1, pages.length));

  return pdf.save();
}

/* ── cover (শুধু পাতা ১) ─────────────────────────────────────────── */

/** আঁকা শেষে পরের কনটেন্ট কোন top-y থেকে শুরু হবে সেটা ফেরত দেয়। */
function drawCover(page: PDFPage, data: MenuPdfData, f: Fonts, name: string): number {
  // কোণার সাজ: পাতার বাইরে গড়ানো কমলা + গোলাপি বৃত্ত — QR কার্ডটা এর উপর বসে।
  page.drawCircle({ x: A4.w + 8, y: Y(-6), size: 196, color: COLOR.orange });
  page.drawCircle({ x: A4.w - 190, y: Y(-30), size: 64, color: COLOR.pink });
  gradientBar(page, 0, 6);

  // লোগো: গোল কমলা চিহ্ন + নাম।
  page.drawCircle({ x: MARGIN + 15, y: Y(58), size: 15, color: COLOR.orange });
  const initial = (name[0] ?? "C").toUpperCase();
  page.drawText(initial, {
    x: MARGIN + 15 - f.serif.widthOfTextAtSize(initial, 18) / 2,
    y: Y(64),
    size: 18,
    font: f.serif,
    color: COLOR.bg,
  });
  page.drawText(name, { x: MARGIN + 40, y: Y(65), size: 24, font: f.serif, color: COLOR.white });

  spaced(page, "FRESH + FAST + DELICIOUS", MARGIN, 118, f.soraBold, 8, COLOR.orange, 2.2);

  // "Our Menu" — Our সাদা, Menu কমলা।
  const TITLE = 62;
  page.drawText("Our ", { x: MARGIN, y: Y(178), size: TITLE, font: f.serif, color: COLOR.white });
  page.drawText("Menu", {
    x: MARGIN + f.serif.widthOfTextAtSize("Our ", TITLE),
    y: Y(178),
    size: TITLE,
    font: f.serif,
    color: COLOR.orange,
  });

  wrap("Freshly prepared meals from our kitchen to your table, or right to your doorstep.", f.sora, 10, 300).forEach(
    (line, i) =>
      page.drawText(line, { x: MARGIN, y: Y(204 + i * 15), size: 10, font: f.sora, color: COLOR.soft })
  );

  // QR কার্ড (ডানে, কমলা বৃত্তের উপর)।
  const CARD_W = 124;
  const CARD_H = 156;
  const cardX = A4.w - MARGIN - CARD_W;
  const cardTop = 38;
  roundedRect(page, cardX, cardTop, CARD_W, CARD_H, 16, { fill: COLOR.white });
  const QR = 92;
  drawQr(page, data.qrUrl, cardX + (CARD_W - QR) / 2, cardTop + 16, QR);
  const cap = "Scan to order online";
  page.drawText(cap, {
    x: cardX + (CARD_W - f.soraBold.widthOfTextAtSize(cap, 8)) / 2,
    y: Y(cardTop + 16 + QR + 18),
    size: 8,
    font: f.soraBold,
    color: COLOR.bg,
  });
  const url = clean(data.displayUrl, f.sora);
  const urlSize = Math.min(6.5, (CARD_W - 14) / Math.max(1, f.sora.widthOfTextAtSize(url, 1)));
  page.drawText(url, {
    x: cardX + (CARD_W - f.sora.widthOfTextAtSize(url, urlSize)) / 2,
    y: Y(cardTop + 16 + QR + 30),
    size: urlSize,
    font: f.sora,
    color: COLOR.mute,
  });

  return 242;
}

/* ── একটা পদ ─────────────────────────────────────────────────────── */

type ItemBlock = { height: number; draw: (page: PDFPage, x: number, top: number) => void };

function layoutItem(item: MenuPdfItem, data: MenuPdfData, f: Fonts, width: number): ItemBlock {
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
  const titleMax = width - rightBlockW - 12;
  const titleLines = clamp(wrap(title, f.soraBold, TITLE, titleMax), 2, f.soraBold, TITLE, titleMax);

  const descLines = clamp(wrap(clean(item.description, f.sora), f.sora, DESC, width), 2, f.sora, DESC, width);

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
      titleLines.forEach((line, i) =>
        page.drawText(line, {
          x,
          y: Y(top) - TITLE - i * 14 + 2,
          size: TITLE,
          font: f.soraBold,
          color: COLOR.white,
        })
      );

      // দাম — ডানে লাগানো, প্রথম লাইনের সারিতে। offer থাকলে গোলাপি, নইলে কমলা।
      const baseY = Y(top) - TITLE + 2;
      const priceX = x + width - priceW;
      page.drawText(priceText, {
        x: priceX,
        y: baseY,
        size: TITLE,
        font: f.soraBold,
        color: oldText ? COLOR.pink : COLOR.orange,
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
        const lead1 = x + width - rightBlockW - 6;
        if (lead1 - lead0 > 14) {
          page.drawLine({
            start: { x: lead0, y: baseY + 0.4 },
            end: { x: lead1, y: baseY + 0.4 },
            thickness: 1,
            color: COLOR.dots,
            dashArray: [0.1, 3.2],
            lineCap: LineCapStyle.Round,
          });
        }
      }

      const descTop = top + titleLines.length * 14;
      descLines.forEach((line, i) =>
        page.drawText(line, {
          x,
          y: Y(descTop) - DESC - i * 11.5 + 1,
          size: DESC,
          font: f.sora,
          color: COLOR.soft,
        })
      );

      if (hasMeta) {
        const metaTop = descTop + (descLines.length ? descLines.length * 11.5 + 2 : 0);
        const my = Y(metaTop) - META - 2;
        let mx = x;
        if (badge) {
          page.drawText(badge, { x: mx, y: my, size: META, font: f.soraBold, color: COLOR.pink });
          mx += f.soraBold.widthOfTextAtSize(badge, META) + (meta ? 8 : 0);
        }
        if (meta) page.drawText(meta, { x: mx, y: my, size: META, font: f.sora, color: COLOR.mute });
      }
    },
  };
}

/* ── footer ──────────────────────────────────────────────────────── */

function drawFooter(page: PDFPage, data: MenuPdfData, f: Fonts, n: number, total: number) {
  const top = FOOTER_TOP + 8;
  const H = 22;

  // বাঁ থেকে: ঠিকানা (কমলা ভরাট), সময় (কমলা ধার), ফোন (থাকলে)।
  const pageLabel = `${n} / ${total}`;
  const pageW = f.sora.widthOfTextAtSize(pageLabel, 8);
  let x = MARGIN;
  const maxRight = A4.w - MARGIN - pageW - 14;

  const address = clamp(
    wrap(clean(data.address, f.soraBold), f.soraBold, 8, 200),
    1,
    f.soraBold,
    8,
    200
  )[0];
  if (address) {
    x += pill(page, address, x, top, f.soraBold, { size: 8, h: H, radius: 11, padX: 12, fill: COLOR.orange, color: COLOR.bg }) + 8;
  }

  const hours = `Daily ${clean(data.hoursLabel, f.sora)}`;
  const hoursW = f.sora.widthOfTextAtSize(hours, 8) + 24;
  if (x + hoursW <= maxRight) {
    x += pill(page, hours, x, top, f.sora, { size: 8, h: H, radius: 11, padX: 12, stroke: COLOR.orange, color: COLOR.white }) + 8;
  }

  if (data.phone?.trim()) {
    const phone = clean(data.phone, f.sora);
    if (x + f.sora.widthOfTextAtSize(phone, 8) + 24 <= maxRight) {
      pill(page, phone, x, top, f.sora, { size: 8, h: H, radius: 11, padX: 12, stroke: COLOR.orange, color: COLOR.white });
    }
  }

  page.drawText(pageLabel, {
    x: A4.w - MARGIN - pageW,
    y: Y(top + H / 2 + 8 * 0.35),
    size: 8,
    font: f.sora,
    color: COLOR.mute,
  });

  const note = [`Prices as of ${data.generatedOn}`, data.taxNote].filter(Boolean).join("  \u00B7  ");
  const noteLine = clamp(wrap(clean(note, f.sora), f.sora, 7, CONTENT_W), 1, f.sora, 7, CONTENT_W)[0] ?? "";
  page.drawText(noteLine, { x: MARGIN, y: Y(top + H + 14), size: 7, font: f.sora, color: COLOR.mute });
}
