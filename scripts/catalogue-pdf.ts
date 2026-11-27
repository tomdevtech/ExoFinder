/**
 * Lays out the printed catalogue: a cover, a foreword, the contents, one page per body, the sources and an
 * index. Every body takes exactly one page, so the page numbers are known before the first page is
 * written, and the file can be written from front to back without being held in memory.
 */
import { createHash } from "node:crypto";
import { createWriteStream, readFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { sourceGroups } from "@/app/credits/sources";
import { en } from "@/i18n/messages/en";
import type { FactRow } from "@/shared/facts";
import { seededRandom } from "@/shared/math";
import type { CatalogueEntry, FactSection } from "./catalogue-entries";
import { PAGE_COLOUR } from "./catalogue-pictures";

type Doc = PDFKit.PDFDocument;

/** The catalogue comes in one language, so its sources are the English ones. */
const SOURCES = sourceGroups(en);

export interface Edition {
  /** The name of the catalogue, as the cover and the foot of every page give it. */
  title: string;
  /** What the catalogue holds, for the description of the file. */
  claim: string;
  /** The address of the site, which every page links to. */
  site: string;
  /** The day the catalogue was put together. */
  date: Date;
}

/** A4 in points. */
const WIDTH = 595.28;
const HEIGHT = 841.89;
const MARGIN = 48;
const INNER = WIDTH - 2 * MARGIN;
/** Where the text of a page ends, above its foot line. */
const BOTTOM = HEIGHT - 64;

const FOREGROUND = "#e6e8ef";
const MUTED = "#8b90a3";
const LINE = "#1c2030";
const ACCENT = "#8fb8ff";

const FONTS = path.join("node_modules", "geist", "dist", "fonts");
const REGULAR = "regular";
const SEMIBOLD = "semibold";
const MONO = "mono";

const PICTURE = 300;
const CHAPTERS = { solar: "The solar system", exoplanets: "Exoplanets" } as const;

/** A line of the contents or of the index. */
interface ListItem {
  label: string;
  /** A remark behind the label, such as the distance of a star. */
  note?: string;
  /** The page the line leads to, or a range of pages as text. */
  page: string;
  /** The name of the destination in the file. */
  target: string;
  indent?: number;
  strong?: boolean;
}

/** A run of lines of the contents that share a number of columns. */
interface ListBlock {
  columns: number;
  size: number;
  items: ListItem[];
}

const targetOf = (page: number) => `page-${page}`;

function newPage(doc: Doc, page: number): void {
  doc.addPage({ size: [WIDTH, HEIGHT], margin: 0 });
  doc.rect(0, 0, WIDTH, HEIGHT).fill(PAGE_COLOUR);
  doc.addNamedDestination(targetOf(page), "Fit");
}

/** The line at the foot of a page: the edition on the left, the page number on the right. */
function foot(doc: Doc, edition: Edition, page: number): void {
  doc.font(REGULAR).fontSize(7.5).fillColor(MUTED);
  doc.text(`ExoFinder · ${edition.title}`, MARGIN, HEIGHT - 40, { lineBreak: false });
  doc.text(String(page), MARGIN, HEIGHT - 40, { width: INNER, align: "right", lineBreak: false });
}

/** Scatters faint stars over the page, the same ones in every run. */
function starfield(doc: Doc, seed: number, count: number): void {
  const random = seededRandom(seed);
  for (let star = 0; star < count; star++) {
    const bright = random() ** 3;
    doc
      .circle(random() * WIDTH, random() * HEIGHT, 0.35 + bright * 0.9)
      .fillOpacity(0.25 + bright * 0.6)
      .fill(random() < 0.2 ? ACCENT : FOREGROUND);
  }
  doc.fillOpacity(1);
}

/** The mark of the site: a planet crossing its star, as Logo.tsx draws it. `radius` is that of the star. */
function mark(doc: Doc, x: number, y: number, radius: number): void {
  const unit = radius / 28;
  const glow = doc.radialGradient(x, y, radius * 0.9, x, y, radius * 2.3);
  glow.stop(0, "#1b2030", 0.9).stop(1, PAGE_COLOUR, 0);
  doc.circle(x, y, radius * 2.3).fill(glow);
  // The gradient of the logo is centred a little to the upper left of the disc, which is 56 units wide.
  const centre = [x + (0.4 - 0.5) * 56 * unit, y + (0.38 - 0.5) * 56 * unit];
  const disc = doc.radialGradient(centre[0], centre[1], 0, centre[0], centre[1], 0.65 * 56 * unit);
  disc.stop(0, "#fff6e0").stop(0.6, "#f4e6c4").stop(1, "#ffd98a");
  doc.circle(x, y, radius).fill(disc);
  doc
    .circle(x + 11.5 * unit, y + 7.6 * unit, 10.8 * unit)
    .lineWidth(2 * unit)
    .fillAndStroke(PAGE_COLOUR, ACCENT);
}

function cover(doc: Doc, edition: Edition): void {
  newPage(doc, 1);
  starfield(doc, 7, 260);
  mark(doc, WIDTH / 2, 300, 132);
  doc.font(SEMIBOLD).fontSize(62).fillColor(FOREGROUND);
  doc.text("ExoFinder", 0, 520, { width: WIDTH, align: "center", characterSpacing: -1 });
  doc.font(REGULAR).fontSize(17).fillColor("#b9bdcc");
  doc.text("Every known exoplanet in one place", 0, 606, { width: WIDTH, align: "center" });
  doc.fontSize(11).fillColor(MUTED);
  doc.text(`${edition.title} · ${monthOf(edition.date)}`, 0, 640, { width: WIDTH, align: "center" });
  const address = edition.site.replace(/^https?:\/\//, "");
  doc.fontSize(12).fillColor(ACCENT);
  doc.text(address, 0, 700, { width: WIDTH, align: "center", link: edition.site });
}

const monthOf = (date: Date) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
const dayOf = (date: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(date);

function heading(doc: Doc, text: string, y: number): number {
  doc.font(SEMIBOLD).fontSize(26).fillColor(FOREGROUND);
  doc.text(text, MARGIN, y, { width: INNER });
  return doc.y + 14;
}

/** Writes paragraphs below each other, each as a small title and its text, and returns where they end. */
function paragraphs(doc: Doc, parts: [title: string | null, text: string][], y: number): number {
  for (const [title, text] of parts) {
    if (title) {
      doc.font(SEMIBOLD).fontSize(11).fillColor(FOREGROUND);
      doc.text(title, MARGIN, y, { width: INNER });
      y = doc.y + 4;
    }
    doc.font(REGULAR).fontSize(10).fillColor("#c3c7d4");
    doc.text(text, MARGIN, y, { width: INNER, lineGap: 3.5 });
    y = doc.y + 14;
  }
  return y;
}

function foreword(doc: Doc, edition: Edition, entries: CatalogueEntry[], page: number): void {
  const exoplanets = entries.filter((entry) => entry.chapter === "exoplanets").length;
  const solar = entries.length - exoplanets;
  newPage(doc, page);
  const y = heading(doc, "About this catalogue", 72);
  paragraphs(
    doc,
    [
      [
        null,
        `This catalogue holds ${en.fmt.count(entries.length)} bodies, one to a page: ${
          exoplanets > 0
            ? `the Sun and the ${en.fmt.count(solar - 1)} planets, moons and dwarf planets of the solar system, and the ${en.fmt.count(exoplanets)} planets of other stars that NASA lists as confirmed`
            : `the Sun and the ${en.fmt.count(solar - 1)} planets, moons and dwarf planets that circle it`
        }. It was put together on ${dayOf(edition.date)} from the same data as ${edition.site.replace(/^https?:\/\//, "")}, where every body has a page with a model that can be turned and zoomed. The address at the foot of a page leads there.`,
      ],
      [
        "The order",
        `The solar system comes first, from the inside out: every body that orbits the Sun is followed by its large moons and then its small ones.${
          exoplanets > 0
            ? " The exoplanets follow by the distance of their star from the Sun, the nearest first, and the planets of one star from the inside out. Systems whose distance is not known come last."
            : ""
        } The number at the top of a page counts the bodies in this order. It is the number the site shows for the same body.`,
      ],
      [
        "Which pictures are real",
        `The planets, the large moons and the dwarf planets of the solar system are drawn from real maps, put together from spacecraft images, and the irregular bodies from shape models that spacecraft measured. ${
          exoplanets > 0
            ? "Nobody has seen an exoplanet up close. Its picture is computed from its measured values and shows what a planet of that size and temperature could look like; what nobody has measured, such as the lie of its continents, is drawn by lot and stays the same for each planet. "
            : ""
        }Most small moons have only been seen as points of light, so their shapes and surfaces are made up. Every page says below its values which kind of picture it shows.`,
      ],
      [
        "How to read the values",
        "“Calculated” marks a value that was derived from other measurements instead of being measured. “Minimum mass” means that only a lower limit is known, and the true mass may be higher. “≈” and “estimated” mark the size of a small moon that was worked out from its brightness. A value that nobody has measured reads “unknown”. The equilibrium temperature ignores any atmosphere, so a surface can be much warmer. 1 AU is the distance between Earth and the Sun, and an eccentricity of 0 is a perfect circle.",
      ],
      [
        "Sources",
        "The values come from the NASA Exoplanet Archive, the NASA Planetary Fact Sheet and JPL Solar System Dynamics. Every source of a value, a map and a shape is listed with its licence at the end of the catalogue.",
      ],
    ],
    y,
  );
  foot(doc, edition, page);
}

/** How many lines of a list fit a column that starts at `top`. */
const linesIn = (top: number, lineHeight: number) => Math.max(0, Math.floor((BOTTOM - top) / lineHeight));

/**
 * Splits the blocks of a list into pages of columns, top to bottom and then left to right. It measures
 * nothing but line counts, so the number of pages is known before the list is written.
 */
function paginate(blocks: ListBlock[], firstTop: number, laterTop: number) {
  type Placed = { block: ListBlock; top: number; columns: ListItem[][] };
  const pages: Placed[][] = [[]];
  let top = firstTop;
  for (const block of blocks) {
    const lineHeight = block.size * 1.55;
    let rest = block.items;
    while (rest.length > 0) {
      let room = linesIn(top, lineHeight);
      // A block does not start with a few lonely lines at the foot of a page.
      if (room < Math.min(4, Math.ceil(rest.length / block.columns))) {
        pages.push([]);
        top = laterTop;
        room = linesIn(top, lineHeight);
      }
      const rows = Math.min(room, Math.ceil(rest.length / block.columns));
      const columns = Array.from({ length: block.columns }, (_, column) => rest.slice(column * rows, (column + 1) * rows));
      pages[pages.length - 1].push({ block, top, columns });
      rest = rest.slice(rows * block.columns);
      top += rows * lineHeight + 10;
    }
  }
  return pages;
}

function listPages(
  doc: Doc,
  edition: Edition,
  title: string,
  blocks: ListBlock[],
  firstPage: number,
): void {
  const gap = 18;
  paginate(blocks, 124, 72).forEach((placed, index) => {
    newPage(doc, firstPage + index);
    if (index === 0) {
      heading(doc, title, 72);
      // A bookmark leads to the page that is current when it is made, so it is made on the first page.
      doc.outline.addItem(title);
    }
    for (const { block, top, columns } of placed) {
      const lineHeight = block.size * 1.55;
      const width = (INNER - gap * (block.columns - 1)) / block.columns;
      columns.forEach((items, column) => {
        const left = MARGIN + column * (width + gap);
        items.forEach((item, row) => {
          const y = top + row * lineHeight;
          const x = left + (item.indent ?? 0) * 12;
          doc.font(REGULAR).fontSize(block.size).fillColor(MUTED);
          const pageWidth = doc.widthOfString(item.page);
          doc.text(item.page, left, y, { width, align: "right", lineBreak: false });
          const room = left + width - pageWidth - 8 - x;
          doc.font(item.strong ? SEMIBOLD : REGULAR).fillColor(FOREGROUND);
          doc.text(item.label, x, y, { width: room, lineBreak: false, ellipsis: true });
          let end = x + Math.min(doc.widthOfString(item.label), room);
          // A remark is left out where the name leaves no room for all of it: half a distance says nothing.
          doc.font(REGULAR);
          const noteWidth = item.note ? doc.widthOfString(item.note) : 0;
          if (item.note && end + 5 + noteWidth <= x + room) {
            doc.fillColor(MUTED).text(item.note, end + 5, y, { lineBreak: false });
            end += 5 + noteWidth;
          }
          const leaderEnd = left + width - pageWidth - 5;
          if (leaderEnd - end > 14) {
            doc
              .moveTo(end + 5, y + block.size * 0.82)
              .lineTo(leaderEnd, y + block.size * 0.82)
              .lineWidth(0.5)
              .dash(0.5, { space: 2.5 })
              .stroke("#3a4058")
              .undash();
          }
          doc.goTo(left, y - 1, width, lineHeight, item.target);
        });
      });
    }
    foot(doc, edition, firstPage + index);
  });
}

/** Digits sort as numbers, so that "Kepler-9 b" comes before "Kepler-10 b". */
const byName = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** The lines of the contents, without the pages of the contents itself, which are not known yet. */
function contentsBlocks(
  entries: CatalogueEntry[],
  pageOf: (entry: CatalogueEntry) => number,
  parts: { foreword: number; chapters: Map<string, number>; sources: number; index: number },
): ListBlock[] {
  const line = (label: string, page: number, extra: Partial<ListItem> = {}): ListItem => ({
    label,
    page: String(page),
    target: targetOf(page),
    ...extra,
  });
  const blocks: ListBlock[] = [{ columns: 1, size: 10.5, items: [line("About this catalogue", parts.foreword, { strong: true })] }];

  const solar = entries.filter((entry) => entry.chapter === "solar");
  if (solar.length > 0) {
    const items: ListItem[] = [];
    for (let at = 0; at < solar.length; at++) {
      const entry = solar[at];
      if (entry.rank !== "small") {
        items.push(line(entry.name, pageOf(entry), { indent: entry.rank === "moon" ? 1 : 0 }));
        continue;
      }
      // The small moons of a planet stand on consecutive pages, so one line names them all.
      let last = at;
      while (last + 1 < solar.length && solar[last + 1].rank === "small" && solar[last + 1].group === entry.group) last++;
      const count = last - at + 1;
      items.push({
        label: count === 1 ? entry.name : `${en.fmt.count(count)} small moons`,
        page: count === 1 ? String(pageOf(entry)) : `${pageOf(entry)}–${pageOf(solar[last])}`,
        target: targetOf(pageOf(entry)),
        indent: 1,
      });
      at = last;
    }
    blocks.push({ columns: 1, size: 10.5, items: [line(CHAPTERS.solar, parts.chapters.get("solar")!, { strong: true })] });
    blocks.push({ columns: 2, size: 9.5, items });
  }

  const exoplanets = entries.filter((entry) => entry.chapter === "exoplanets");
  if (exoplanets.length > 0) {
    // One line per system, which leads to its innermost planet.
    const systems = exoplanets.filter((entry, at) => at === 0 || exoplanets[at - 1].group !== entry.group);
    blocks.push({ columns: 1, size: 10.5, items: [line(CHAPTERS.exoplanets, parts.chapters.get("exoplanets")!, { strong: true })] });
    blocks.push({
      columns: 3,
      size: 8,
      items: systems.map((entry) => line(entry.group, pageOf(entry), { note: entry.groupNote?.replace(" light-years", " ly") })),
    });
  }

  blocks.push({
    columns: 1,
    size: 10.5,
    items: [line("Sources", parts.sources, { strong: true }), line("Index", parts.index, { strong: true })],
  });
  return blocks;
}

function chapterPage(doc: Doc, edition: Edition, chapter: keyof typeof CHAPTERS, entries: CatalogueEntry[], page: number): void {
  const own = entries.filter((entry) => entry.chapter === chapter);
  newPage(doc, page);
  starfield(doc, chapter === "solar" ? 21 : 34, 180);
  doc.font(REGULAR).fontSize(11).fillColor(ACCENT);
  doc.text(chapter === "solar" ? "Part one" : own.length === entries.length ? "The catalogue" : "Part two", MARGIN, 300);
  doc.font(SEMIBOLD).fontSize(44).fillColor(FOREGROUND);
  doc.text(CHAPTERS[chapter], MARGIN, 322, { width: INNER, characterSpacing: -0.5 });
  const count = (rank: CatalogueEntry["rank"]) => own.filter((entry) => entry.rank === rank).length;
  const text =
    chapter === "solar"
      ? `The Sun and the ${en.fmt.count(count("main"))} planets, dwarf planets and asteroids that orbit it and have a page of their own, with ${en.fmt.count(count("moon"))} large moons and ${en.fmt.count(count("small"))} small ones. From the inside out: each body is followed by its moons.`
      : `${en.fmt.count(own.length)} planets of ${en.fmt.count(new Set(own.map((entry) => entry.group)).size)} other stars, as the NASA Exoplanet Archive lists them. The nearest system comes first, and the planets of a system from the inside out.`;
  doc.font(REGULAR).fontSize(12).fillColor("#c3c7d4");
  doc.text(text, MARGIN, doc.y + 18, { width: INNER * 0.72, lineGap: 4 });
  foot(doc, edition, page);
}

/** The height of a row of facts in a column of the given width, and how its label and value share the line. */
function measureRow(doc: Doc, row: FactRow, width: number) {
  doc.font(REGULAR).fontSize(9);
  const labelWidth = doc.widthOfString(row.label);
  const note = row.value !== null && row.note ? `  ${row.note}` : "";
  doc.fontSize(7.5);
  const noteWidth = note ? doc.widthOfString(note) : 0;
  const value = row.value ?? "unknown";
  doc.font(row.value === null ? REGULAR : MONO).fontSize(9);
  // A long value, such as a list of discoverers, gets the line below its label to itself.
  const beside = width - labelWidth - 12 - noteWidth;
  const stacked = doc.widthOfString(value) > beside && beside < width * 0.55;
  const valueWidth = stacked ? width - noteWidth : beside;
  const valueHeight = doc.heightOfString(value, { width: valueWidth, align: "right", lineGap: 1.5 });
  return { note, noteWidth, value, stacked, valueWidth, height: (stacked ? 13 : 0) + Math.max(valueHeight, 10) + 9 };
}

function drawSection(doc: Doc, section: FactSection, x: number, y: number, width: number): number {
  doc.font(SEMIBOLD).fontSize(11).fillColor(FOREGROUND);
  doc.text(section.title, x, y, { width, lineBreak: false, ellipsis: true });
  y += 20;
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.6).stroke(LINE);
  for (const row of section.rows) {
    const measured = measureRow(doc, row, width);
    const top = y + 5;
    doc.font(REGULAR).fontSize(9).fillColor(MUTED);
    doc.text(row.label, x, top, { lineBreak: false });
    const valueTop = top + (measured.stacked ? 13 : 0);
    doc.font(row.value === null ? REGULAR : MONO).fontSize(9).fillColor(row.value === null ? MUTED : FOREGROUND);
    doc.text(measured.value, x + width - measured.noteWidth - measured.valueWidth, valueTop, {
      width: measured.valueWidth,
      align: "right",
      lineGap: 1.5,
    });
    if (measured.note) {
      doc.font(REGULAR).fontSize(7.5).fillColor(MUTED);
      doc.text(measured.note, x + width - measured.noteWidth, valueTop + 1.2, { lineBreak: false });
    }
    y += measured.height;
    doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.6).stroke(LINE);
  }
  return y + 4;
}

function entryPage(doc: Doc, edition: Edition, entry: CatalogueEntry, picture: string, page: number): void {
  newPage(doc, page);
  doc.font(REGULAR).fontSize(8.5).fillColor(MUTED);
  const where = [CHAPTERS[entry.chapter], entry.group === entry.name ? null : entry.group, entry.groupNote].filter(Boolean).join(" · ");
  doc.text(where, MARGIN, 36, { lineBreak: false });
  if (entry.number !== null) {
    doc.text(`No. ${en.fmt.count(entry.number)}`, MARGIN, 36, { width: INNER, align: "right", lineBreak: false });
  }

  doc.image(picture, (WIDTH - PICTURE) / 2, 58, { width: PICTURE, height: PICTURE });

  doc.font(SEMIBOLD).fontSize(30).fillColor(FOREGROUND);
  doc.text(entry.name, MARGIN, 374, { width: INNER, characterSpacing: -0.4, lineBreak: false, ellipsis: true });
  doc.font(REGULAR).fontSize(12).fillColor(MUTED);
  doc.text(entry.kind, MARGIN, 412, { width: INNER });
  let y = doc.y + 10;
  if (entry.text) {
    doc.fontSize(10).fillColor("#c3c7d4");
    doc.text(entry.text, MARGIN, y, { width: INNER, lineGap: 3 });
    y = doc.y + 12;
  }

  // The sections fill two columns, each going to the one that is shorter so far.
  const gap = 28;
  const width = (INNER - gap) / 2;
  const columns = [y + 6, y + 6];
  for (const section of entry.sections) {
    const column = columns[1] < columns[0] ? 1 : 0;
    columns[column] = drawSection(doc, section, MARGIN + column * (width + gap), columns[column], width) + 12;
  }

  const address = `${edition.site}${entry.href}`;
  doc.font(REGULAR).fontSize(7.5);
  const note = `${entry.pictureNote} ${entry.sourceNote}`;
  const noteHeight = doc.heightOfString(note, { width: INNER, lineGap: 1.5 });
  const noteTop = HEIGHT - 68 - noteHeight;
  doc.fillColor(MUTED).text(note, MARGIN, noteTop, { width: INNER, lineGap: 1.5 });
  // The address stands on a line of its own, so that it is never broken at one of its hyphens.
  doc.fillColor(ACCENT).text(address.replace(/^https?:\/\//, ""), MARGIN, noteTop + noteHeight + 3, { link: address, lineBreak: false });
  foot(doc, edition, page);
}

/**
 * Writes the sources below each other and returns the number of pages they take. Without `write` it only
 * measures, which tells where the index starts before the contents are written.
 */
function sourcePages(doc: Doc, edition: Edition, firstPage: number, write: boolean): number {
  let page = firstPage;
  let y = 72;
  const turn = () => {
    if (write) foot(doc, edition, page);
    page++;
    y = 72;
    if (write) newPage(doc, page);
  };
  if (write) {
    newPage(doc, page);
    heading(doc, "Sources", 72);
    doc.outline.addItem("Sources");
  }
  y = 124;
  for (const group of SOURCES) {
    doc.font(REGULAR).fontSize(9);
    const introHeight = group.intro ? doc.heightOfString(group.intro, { width: INNER, lineGap: 2.5 }) + 8 : 0;
    if (y + 22 + introHeight + 30 > BOTTOM) turn();
    if (write) {
      doc.font(SEMIBOLD).fontSize(12).fillColor(FOREGROUND);
      doc.text(group.title, MARGIN, y, { width: INNER });
    }
    y += 22;
    if (group.intro) {
      if (write) {
        doc.font(REGULAR).fontSize(9).fillColor("#c3c7d4");
        doc.text(group.intro, MARGIN, y, { width: INNER, lineGap: 2.5 });
      }
      y += introHeight;
    }
    for (const source of group.sources) {
      const credit = `${source.subject}: ${source.credit}${source.licence ? `, ${source.licence.name}` : ""}.${source.note ? ` ${source.note}` : ""}`;
      doc.font(REGULAR).fontSize(9);
      const creditHeight = doc.heightOfString(credit, { width: INNER - 10, lineGap: 2 });
      if (y + creditHeight + 16 > BOTTOM) turn();
      if (write) {
        doc.circle(MARGIN + 2, y + 5.5, 1.1).fill(MUTED);
        doc.font(REGULAR).fontSize(9).fillColor(FOREGROUND);
        doc.text(credit, MARGIN + 10, y, { width: INNER - 10, lineGap: 2 });
        doc.fontSize(7.5).fillColor(ACCENT);
        doc.text(source.url.replace(/^https?:\/\//, ""), MARGIN + 10, y + creditHeight + 1, {
          width: INNER - 10,
          lineBreak: false,
          ellipsis: true,
          link: source.url,
        });
      }
      y += creditHeight + 17;
    }
    y += 12;
  }
  if (write) foot(doc, edition, page);
  return page - firstPage + 1;
}

/** The code that decides what stands on a page and where. A change to it changes the file. */
const LAYOUT = ["catalogue-entries.ts", "catalogue-pdf.ts"];

/**
 * Everything the file is made from, as one hash: the text of every page, its picture, the sources and the
 * code that lays them out. Two runs with the same stamp would write the same file, so the second need not
 * write it. The day of the build is left out, or no two files would ever count as the same.
 */
export function catalogueStamp(edition: Edition, entries: CatalogueEntry[], pictures: Map<CatalogueEntry, string>): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify([edition.title, edition.claim, edition.site, SOURCES]));
  for (const file of LAYOUT) hash.update(readFileSync(path.join("scripts", file)));
  // A picture file is named after everything that shapes the picture, so its name stands for the picture.
  for (const entry of entries) hash.update(JSON.stringify([{ ...entry, picture: null }, path.basename(pictures.get(entry) ?? "")]));
  return hash.digest("hex");
}

/** Writes the catalogue to `file`. `pictures` holds the picture file of every entry. */
export async function writeCatalogue(
  file: string,
  edition: Edition,
  entries: CatalogueEntry[],
  pictures: Map<CatalogueEntry, string>,
): Promise<{ pages: number }> {
  // Checked before the file is opened, so that a missing picture leaves no half-written file behind.
  const bare = entries.find((entry) => !pictures.has(entry));
  if (bare) throw new Error(`${bare.name} has no picture.`);
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: [WIDTH, HEIGHT],
    margin: 0,
    pdfVersion: "1.7",
    lang: "en",
    displayTitle: true,
    info: {
      Title: `ExoFinder: ${edition.title}`,
      Author: "ExoFinder",
      Subject: edition.claim,
      Keywords: "exoplanets, planets, moons, catalogue",
      CreationDate: edition.date,
    },
  });
  doc.registerFont(REGULAR, path.join(FONTS, "geist-sans", "Geist-Regular.ttf"));
  doc.registerFont(SEMIBOLD, path.join(FONTS, "geist-sans", "Geist-SemiBold.ttf"));
  doc.registerFont(MONO, path.join(FONTS, "geist-mono", "GeistMono-Regular.ttf"));
  const done = new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(file);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);
  });

  const chapters = (["solar", "exoplanets"] as const).filter((chapter) => entries.some((entry) => entry.chapter === chapter));
  // Text can only be measured once the file has a page, and the cover needs no page number.
  cover(doc, edition);
  doc.outline.addItem("Cover");

  // The contents list their own length, so the pages are laid out with a first guess and again until it holds.
  let contentsLength = 1;
  let plan = layout(contentsLength);
  for (let attempt = 0; attempt < 5; attempt++) {
    const needed = paginate(contentsBlocks(entries, plan.pageOf, plan.parts), 124, 72).length;
    if (needed === contentsLength) break;
    contentsLength = needed;
    plan = layout(contentsLength);
  }

  function layout(contentsPages: number) {
    const pageOfEntry = new Map<CatalogueEntry, number>();
    const chapterPages = new Map<string, number>();
    let page = 2 + contentsPages;
    for (const chapter of chapters) {
      chapterPages.set(chapter, ++page);
      for (const entry of entries) if (entry.chapter === chapter) pageOfEntry.set(entry, ++page);
    }
    const sources = page + 1;
    const index = sources + sourcePages(doc, edition, sources, false);
    return {
      pageOf: (entry: CatalogueEntry) => pageOfEntry.get(entry)!,
      parts: { foreword: 2, chapters: chapterPages, sources, index },
    };
  }

  foreword(doc, edition, entries, 2);
  doc.outline.addItem("About this catalogue");
  listPages(doc, edition, "Contents", contentsBlocks(entries, plan.pageOf, plan.parts), 3);

  for (const chapter of chapters) {
    chapterPage(doc, edition, chapter, entries, plan.parts.chapters.get(chapter)!);
    const chapterItem = doc.outline.addItem(CHAPTERS[chapter]);
    let groupItem = chapterItem;
    let group: string | null = null;
    for (const entry of entries) {
      if (entry.chapter !== chapter) continue;
      entryPage(doc, edition, entry, pictures.get(entry)!, plan.pageOf(entry));
      // The bookmarks follow the contents: a body that orbits the star, with its moons below it.
      if (entry.group !== group || entry.rank === "star") {
        group = entry.group;
        groupItem = chapterItem.addItem(entry.group);
        if (entry.name !== entry.group) groupItem.addItem(entry.name);
      } else if (entry.rank !== "small") {
        groupItem.addItem(entry.name);
      }
    }
  }

  sourcePages(doc, edition, plan.parts.sources, true);
  const index: ListBlock = {
    columns: 4,
    size: 8,
    items: [...entries]
      .sort((a, b) => byName.compare(a.name, b.name))
      .map((entry) => ({ label: entry.name, page: String(plan.pageOf(entry)), target: targetOf(plan.pageOf(entry)) })),
  };
  listPages(doc, edition, "Index", [index], plan.parts.index);

  doc.end();
  await done;
  return { pages: plan.parts.index + paginate([index], 124, 72).length - 1 };
}
