import type { Content, TableCell } from 'pdfmake/interfaces';
import { frame, logo, INK, MUTED, TEAL } from './pdf';
import { linesOf, rateCardSections, rateText, splitLine } from '../domain/rateCard';
import { platformLabel } from '../domain/platforms';
import { addDays, fmtIsoDate } from '../lib/time';
import type { BusinessSettings, Package, PlatformKey, RateCardSettings } from '../db/types';

/**
 * The studio profile & rate card, on the JoshWorks letterhead: a cover
 * (prepared for, dates, confidential), an introduction, portfolio and
 * credentials, the price list section by section, notes and how to reach us.
 * The price list's internal notes and the team's own rates never print.
 */

export interface RateCardSend {
  /** Company or person it's for ('' for a general rate card). */
  preparedFor: string;
  /** Attention: the contact person. */
  attention: string;
  /** YYYY-MM-DD on the cover; the rates hold for the setting's validDays from it. */
  date: string;
  /** "Confidential: internal reference only" on the cover and every page. */
  confidential: boolean;
}

const BAND = '#D3EEF2';
const ZEBRA = '#F4F9F9';
const SOFT_LINE = '#C9D9DA';

const heading = (text: string, first = false): Content => ({
  text: text.toUpperCase(),
  style: 'section',
  headlineLevel: 1,
  ...(first ? { margin: [0, 0, 0, 6] } : {}),
});
const para = (text: string): Content => ({
  text,
  fontSize: 9.5,
  lineHeight: 1.3,
  margin: [0, 0, 0, 6],
});
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Light rules between rows only: easier to read than a full grid. */
const rowsLayout = {
  hLineWidth: (i: number) => (i === 0 ? 0 : 0.6),
  vLineWidth: () => 0,
  hLineColor: () => SOFT_LINE,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 5,
  paddingBottom: () => 5,
  fillColor: (row: number) => (row === 0 ? BAND : row % 2 === 0 ? ZEBRA : null),
};

const head = (text: string, right = false): TableCell => ({
  text: text.toUpperCase(),
  bold: true,
  fontSize: 7.5,
  color: INK,
  characterSpacing: 0.4,
  alignment: right ? 'right' : 'left',
});

function contactLines(b: BusinessSettings): string[] {
  const handles = Object.entries(b.handles ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${platformLabel(k as PlatformKey)} ${v}`);
  return [b.email, b.contact, b.website, ...handles, b.address].filter((x): x is string => !!x && !!x.trim());
}

export async function buildRateCardPdf(s: RateCardSettings, send: RateCardSend, ctx: { business: BusinessSettings; packages: Package[] }) {
  const b = ctx.business;
  const who = send.preparedFor.trim();
  const validUntil = addDays(send.date, s.validDays || 30);
  const both = s.prices === 'both';
  const content: Content[] = [];

  // ----- cover -----
  content.push(
    {
      image: await logo(),
      width: 92,
      alignment: 'center',
      margin: [0, 70, 0, 14],
    },
    {
      text: (b.name || 'JoshWorks').toUpperCase(),
      font: 'Sora',
      fontSize: 30,
      color: INK,
      alignment: 'center',
      characterSpacing: 1,
    },
    {
      text: s.title || 'Studio Profile & Rate Card',
      font: 'Sora',
      fontSize: 16,
      color: TEAL,
      alignment: 'center',
      margin: [0, 4, 0, 4],
    },
    ...(b.tagline
      ? [
          {
            text: b.tagline,
            color: MUTED,
            alignment: 'center',
            fontSize: 10,
          } as Content,
        ]
      : []),
    {
      margin: [60, 46, 60, 0],
      table: {
        widths: [110, '*'],
        body: [
          ...(who ? [[head('Prepared for'), { text: who, bold: true, fontSize: 11 }]] : []),
          ...(send.attention.trim() ? [[head('Attention'), { text: send.attention.trim() }]] : []),
          [head('Date'), { text: fmtIsoDate(send.date) }],
          [head('Rates valid until'), { text: fmtIsoDate(validUntil) }],
        ] as TableCell[][],
      },
      layout: { ...rowsLayout, fillColor: () => null, hLineWidth: () => 0.6 },
    } as Content,
    ...(send.confidential
      ? [
          {
            margin: [60, 18, 60, 0],
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    text: [
                      { text: 'CONFIDENTIAL  ', bold: true, color: TEAL },
                      {
                        text: who
                          ? `For the internal reference of ${who} only. Please don’t publish or share these rates outside your team.`
                          : 'For internal reference only. Please don’t publish or share these rates.',
                      },
                    ],
                    fontSize: 8.5,
                    alignment: 'center',
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.8,
              vLineWidth: () => 0.8,
              hLineColor: () => TEAL,
              vLineColor: () => TEAL,
              paddingTop: () => 7,
              paddingBottom: () => 7,
              paddingLeft: () => 10,
              paddingRight: () => 10,
            },
          } as Content,
        ]
      : []),
    // Everything after the cover starts on page 2 and then flows on.
    {
      text: contactLines(b).join('   ·   '),
      alignment: 'center',
      fontSize: 8.5,
      color: MUTED,
      margin: [30, 60, 30, 0],
      pageBreak: 'after',
    },
  );

  // ----- introduction -----
  if (s.parts.intro) {
    const services = linesOf(s.services).map(splitLine);
    const steps = linesOf(s.process).map(splitLine);
    const why = linesOf(s.why);
    content.push(heading(`About ${b.name || 'JoshWorks'}`, true), ...linesOf(s.about).map(para));
    if (services.length) {
      content.push(heading('What we do'));
      const cells: TableCell[] = services.map((x) => ({
        stack: [{ text: x.head || x.text, bold: true, color: TEAL, fontSize: 9.5 }, ...(x.head ? [{ text: sentence(x.text), fontSize: 8.5, color: INK }] : [])],
        margin: [0, 2, 0, 2],
      }));
      const rows: TableCell[][] = [];
      for (let i = 0; i < cells.length; i += 2) rows.push([cells[i], cells[i + 1] ?? { text: '' }]);
      content.push({
        table: { widths: ['*', '*'], body: rows, dontBreakRows: true },
        layout: {
          ...rowsLayout,
          fillColor: () => null,
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
        },
        margin: [0, 0, 0, 4],
      } as Content);
    }
    if (steps.length) {
      content.push(heading('How we work'), {
        table: {
          dontBreakRows: true,
          widths: [26, '*'],
          body: steps.map((x, i) => [
            {
              text: String(i + 1),
              bold: true,
              color: '#FFFFFF',
              fillColor: TEAL,
              alignment: 'center',
              fontSize: 11,
            },
            {
              text: x.head ? [{ text: `${x.head}: `, bold: true }, { text: x.text }] : x.text,
              fontSize: 9,
            },
          ]) as TableCell[][],
        },
        layout: { ...rowsLayout, fillColor: () => null },
      } as Content);
    }
    if (why.length)
      content.push(heading(`Why ${b.name || 'JoshWorks'}`), {
        ul: why,
        fontSize: 9.5,
        lineHeight: 1.3,
      } as Content);
  }

  // ----- portfolio & credentials -----
  const credentials = linesOf(s.credentials);
  const clients = linesOf(s.clients);
  const url = s.portfolioUrl.trim();
  if (s.parts.portfolio && (url || credentials.length || clients.length)) {
    const left: Content[] = [];
    if (credentials.length)
      left.push({ text: 'Credentials', bold: true, color: TEAL, margin: [0, 0, 0, 3] }, {
        ul: credentials,
        fontSize: 9.5,
        lineHeight: 1.3,
        margin: [0, 0, 0, 8],
      } as Content);
    if (clients.length)
      left.push(
        {
          text: 'Clients & industries',
          bold: true,
          color: TEAL,
          margin: [0, 0, 0, 3],
        },
        { ul: clients, fontSize: 9.5, lineHeight: 1.3 } as Content,
      );
    const link = /^https?:\/\//i.test(url) ? url : url ? `https://${url}` : '';
    // The heading travels with its content, so it never sits alone at the bottom of a page.
    content.push({
      unbreakable: true,
      stack: [
        heading('Portfolio & credentials'),
        {
          columns: [
            {
              stack: left.length
                ? left
                : [
                    {
                      text: 'See our latest work through the link.',
                      fontSize: 9.5,
                    },
                  ],
              width: '*',
            },
            ...(link
              ? [
                  {
                    width: 150,
                    stack: [
                      {
                        qr: link,
                        fit: 120,
                        foreground: INK,
                        alignment: 'center',
                      },
                      {
                        text: 'Scan to see our work',
                        bold: true,
                        alignment: 'center',
                        fontSize: 8.5,
                        margin: [0, 6, 0, 1],
                      },
                      {
                        text: url,
                        link,
                        color: TEAL,
                        alignment: 'center',
                        fontSize: 8,
                      },
                    ],
                  },
                ]
              : []),
          ],
          columnGap: 18,
        },
      ],
    } as Content);
  }

  // ----- the price list -----
  const sections = s.parts.prices ? rateCardSections(ctx.packages, s) : [];
  if (sections.length) {
    const rateHeads = both ? [head('Business', true), head('Student org', true)] : [head(s.prices === 'student' ? 'Student org rate' : 'Rate', true)];
    const rateCells = (p: Package): TableCell[] =>
      both
        ? [
            {
              text: rateText(p, 'business'),
              alignment: 'right',
              bold: true,
              fontSize: 8.5,
            },
            p.unit === 'percent' || p.studentPrice
              ? {
                  text: rateText(p, 'student'),
                  alignment: 'right',
                  fontSize: 8.5,
                }
              : { text: 'Same', alignment: 'right', fontSize: 8, color: MUTED },
          ]
        : [
            {
              text: rateText(p, s.prices === 'student' ? 'student' : 'business'),
              alignment: 'right',
              bold: true,
              fontSize: 8.5,
            },
          ];
    content.push(heading('Rates'), {
      text: `Prices in Philippine pesos${both ? ', for businesses and for student organizations' : s.prices === 'student' ? ', for student organizations' : ''}. Valid until ${fmtIsoDate(validUntil)}.`,
      color: MUTED,
      fontSize: 8.5,
      margin: [0, 0, 0, 4],
    });
    for (const sec of sections) {
      content.push(heading(sec.name));
      if (sec.items.length) {
        // Columns a section has nothing for (e.g. single merch items) are left out, not filled with dashes.
        const incl = sec.items.some((p) => p.includes.length);
        const rev = sec.items.some((p) => p.revisions || p.turnaround);
        const rate = both ? [80, 76] : [94];
        content.push({
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: [incl ? 118 : '*', ...(incl ? ['*'] : []), ...(rev ? [74] : []), ...rate],
            body: [
              [head('Item'), ...(incl ? [head('What’s included')] : []), ...(rev ? [head('Revisions · time')] : []), ...rateHeads],
              ...sec.items.map((p) => [
                {
                  stack: [{ text: p.name, bold: true, fontSize: 9 }, ...(p.tagline ? [{ text: p.tagline, color: MUTED, fontSize: 7.5 }] : [])],
                },
                ...(incl ? [{ text: p.includes.join(' · ') || '', fontSize: 8 }] : []),
                ...(rev
                  ? [
                      {
                        text: [p.revisions ? `${p.revisions} round${p.revisions === 1 ? '' : 's'}` : '', p.turnaround ?? ''].filter(Boolean).join('\n'),
                        fontSize: 8,
                        color: MUTED,
                      },
                    ]
                  : []),
                ...rateCells(p),
              ]),
            ] as TableCell[][],
          },
          layout: rowsLayout,
          margin: [0, 0, 0, 6],
        } as Content);
      }
      if (sec.addOns.length) {
        content.push({
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: both ? ['*', 90, 90] : ['*', 120],
            body: [
              [head(sec.items.length ? 'Add-ons' : 'Item'), ...rateHeads],
              ...sec.addOns.map((p) => [
                {
                  text: p.tagline
                    ? [
                        { text: p.name, bold: true },
                        { text: `  ${p.tagline}`, color: MUTED, fontSize: 7.5 },
                      ]
                    : p.name,
                  fontSize: 8.5,
                },
                ...rateCells(p),
              ]),
            ] as TableCell[][],
          },
          layout: rowsLayout,
          margin: [0, 0, 0, 6],
        } as Content);
      }
    }
  }

  // ----- notes and how to start -----
  const notes = linesOf(s.notes);
  if (s.parts.notes && notes.length)
    content.push(heading('Notes & terms'), {
      ul: notes,
      fontSize: 9,
      lineHeight: 1.3,
      margin: [0, 0, 0, 6],
    } as Content);
  content.push({
    unbreakable: true,
    margin: [0, 14, 0, 0],
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              {
                text: 'Let’s work together',
                font: 'Sora',
                fontSize: 13,
                color: TEAL,
                margin: [0, 0, 0, 4],
              },
              {
                text: 'Tell us about your project and timeline, and we’ll send a quote with the exact scope.',
                fontSize: 9.5,
                margin: [0, 0, 0, 6],
              },
              {
                text: contactLines(b).join('   ·   '),
                fontSize: 9,
                bold: true,
              },
            ],
            fillColor: BAND,
          },
        ],
      ] as TableCell[][],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 12,
      paddingBottom: () => 12,
      paddingLeft: () => 14,
      paddingRight: () => 14,
    },
  } as Content);

  const footer = send.confidential ? `Confidential${who ? ` · prepared for ${who}` : ''}` : s.title || 'Rate card';
  return frame(
    {
      title: `${b.name || 'JoshWorks'} ${s.title || 'Rate Card'}${who ? ` · ${who}` : ''}`,
      business: b.name,
      footerNote: footer,
      letterhead: { frame: 'general', cover: true },
    },
    content,
  );
}
