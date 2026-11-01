import { colLetter, sheetNum } from '@/lib/helpers';

// Hoja tipo Excel (réplica de app/Views/components/sheet.php).
export default function Sheet({
  data,
  caption,
}: {
  data: { headers: unknown[]; rows?: unknown[][] };
  caption?: string;
}) {
  if (!data || !Array.isArray(data.headers) || !data.headers.length) return null;
  const headers = data.headers;
  const rows = data.rows ?? [];
  const cols = headers.length;

  return (
    <div className="xl-sheet my-3">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            <th className="corner" />
            {headers.map((_, c) => (
              <th key={c} className="colh">
                {colLetter(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="rowh">1</th>
            {headers.map((h, i) => (
              <td key={i} className="hd">
                {typeof h === 'number' ? sheetNum(h) : String(h ?? '')}
              </td>
            ))}
          </tr>
          {rows.map((row, i) => (
            <tr key={i}>
              <th className="rowh">{i + 2}</th>
              {Array.from({ length: cols }, (_, c) => {
                const v = Array.isArray(row) ? (row[c] ?? '') : '';
                const isNum = typeof v === 'number';
                const shown = typeof v === 'number' && !Number.isInteger(v) ? sheetNum(v) : String(v);
                return (
                  <td key={c} className={`${isNum ? 'num' : ''}${v === '' ? ' empty-cell' : ''}`}>
                    {shown}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
