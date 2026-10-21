import { strToU8, zipSync } from 'fflate';

/** A tiny workbook built in memory, shaped like a Google Sheets export. */
export function workbook(sheets: { name: string; rows: (string | number)[][]; links?: Record<string, string> }[]): Uint8Array {
  const shared: string[] = [];
  const si = (s: string) => {
    const i = shared.indexOf(s);
    if (i >= 0) return i;
    shared.push(s);
    return shared.length - 1;
  };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const col = (n: number): string => (n > 26 ? col(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(65 + ((n - 1) % 26));
  const files: Record<string, Uint8Array> = {};
  const wbSheets: string[] = [];
  const wbRels: string[] = [];
  sheets.forEach((sh, i) => {
    const rowsXml = sh.rows
      .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (v === '' ? '' : typeof v === 'number' ? `<c r="${col(ci + 1)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci + 1)}${ri + 1}" t="s"><v>${si(v)}</v></c>`)).join('')}</row>`)
      .join('');
    const links = Object.entries(sh.links ?? {});
    const linksXml = links.length ? `<hyperlinks>${links.map(([ref], k) => `<hyperlink ref="${ref}" r:id="rIdL${k}"/>`).join('')}</hyperlinks>` : '';
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<?xml version="1.0"?><worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rowsXml}</sheetData>${linksXml}</worksheet>`);
    if (links.length) {
      files[`xl/worksheets/_rels/sheet${i + 1}.xml.rels`] = strToU8(`<?xml version="1.0"?><Relationships>${links.map(([, url], k) => `<Relationship Id="rIdL${k}" Type="hyperlink" Target="${esc(url)}" TargetMode="External"/>`).join('')}</Relationships>`);
    }
    wbSheets.push(`<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`);
    wbRels.push(`<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
  });
  files['xl/workbook.xml'] = strToU8(`<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${wbSheets.join('')}</sheets></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = strToU8(`<?xml version="1.0"?><Relationships>${wbRels.join('')}</Relationships>`);
  files['xl/sharedStrings.xml'] = strToU8(`<?xml version="1.0"?><sst>${shared.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);
  return zipSync(files);
}
