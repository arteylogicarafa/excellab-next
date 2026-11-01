import JSZip from 'jszip';
import { colLetter } from '../helpers';

// Generador mínimo de archivos .xlsx (réplica de app/Services/XlsxWriter.php) usando jszip.

function xml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Contenido binario del .xlsx. */
export async function build(headers: unknown[], rows: unknown[][], sheetName = 'Datos'): Promise<Uint8Array> {
  const cleanName =
    sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Datos';
  const all = [headers, ...rows];
  let sheetRows = '';
  const maxLen: number[] = [];
  all.forEach((row, r) => {
    let cells = '';
    const arr = Array.isArray(row) ? row : [];
    arr.forEach((val, c) => {
      const ref = colLetter(c) + (r + 1);
      maxLen[c] = Math.max(maxLen[c] ?? 8, Math.min(40, String(val ?? '').length + 3));
      const style = r === 0 ? ' s="1"' : '';
      if (val === '' || val === null || val === undefined) {
        if (r === 0) cells += `<c r="${ref}"${style}/>`;
      } else if (typeof val === 'string' && val.startsWith('=')) {
        cells += `<c r="${ref}"${style}><f>${xml(val.slice(1))}</f></c>`;
      } else if (typeof val === 'number') {
        cells += `<c r="${ref}"${style}><v>${val}</v></c>`;
      } else {
        cells += `<c r="${ref}" t="inlineStr"${style}><is><t>${xml(val)}</t></is></c>`;
      }
    });
    sheetRows += `<row r="${r + 1}">${cells}</row>`;
  });
  let cols = '';
  maxLen.forEach((w, c) => {
    cols += `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`;
  });

  const files: Record<string, string> = {
    '[Content_Types].xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' +
      xml(cleanName) +
      '" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF217346"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>' +
      cols +
      '</cols><sheetData>' +
      sheetRows +
      '</sheetData></worksheet>',
  };

  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'uint8array' });
}
