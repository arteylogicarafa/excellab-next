// Corrección automática de respuestas (réplica de app/Services/ExerciseEvaluator.php).
// Tipos de respuesta: option (id de opción), number (con tolerancia), formula (normalizada) y text.
// En correct_answer se admiten alternativas separadas por "||".

export function normalizeFormula(s: string): string {
  let x = s.replace(/[“”«»]/g, '"');
  x = x.replace(/\s+/gu, '');
  x = x.toUpperCase();
  return x.replace(/;/g, ',');
}

export function normalizeText(s: string): string {
  let x = s.replace(/\s+/gu, ' ').trim().toLowerCase();
  const map: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };
  return x.replace(/[áéíóúüñ]/g, (c) => map[c] ?? c);
}

export function parseNumber(s: string): number | null {
  let x = s.replace(/[%$\s ]/g, '').trim();
  if (x === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(x)) {
    // 1.234,56
    x = x.replace(/\./g, '').replace(/,/g, '.');
  } else if ((x.match(/,/g) || []).length === 1 && !x.includes('.')) {
    // 12,5
    x = x.replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) {
    // 1,234.56
    x = x.replace(/,/g, '');
  }
  const n = Number(x);
  return x !== '' && Number.isFinite(n) ? n : null;
}

/** Compara una respuesta libre con la respuesta esperada. */
export function matches(kind: string, answer: string, expected: string, tolerance = 0.01): boolean {
  const alternatives = expected
    .split('||')
    .map((x) => x.trim())
    .filter((x) => x !== '');
  for (const alt of alternatives) {
    switch (kind) {
      case 'number': {
        const a = parseNumber(answer);
        const b = parseNumber(alt);
        if (a !== null && b !== null && Math.abs(a - b) <= tolerance + 1e-9) return true;
        break;
      }
      case 'formula':
        if (normalizeFormula(answer) === normalizeFormula(alt)) return true;
        break;
      default:
        if (normalizeText(answer) === normalizeText(alt)) return true;
    }
  }
  return false;
}

/** [esCorrecta, textoRespuestaCorrecta]. */
export function check(
  ex: Record<string, unknown>,
  answer: string,
  options: { id: number | string; label: string; is_correct: number | string }[] = [],
): [boolean, string] {
  const ans = answer.trim();
  if (ex.answer_kind === 'option') {
    let correct: string | null = null;
    let ok = false;
    for (const o of options) {
      if (Number(o.is_correct)) {
        correct = String(o.label);
        if (String(o.id) === ans) ok = true;
      }
    }
    return [ok, String(correct)];
  }
  const first = String(ex.correct_answer ?? '').split('||')[0].trim();
  if (ans === '') return [false, first];
  return [matches(String(ex.answer_kind), ans, String(ex.correct_answer ?? ''), Number(ex.tolerance ?? 0.01)), first];
}
