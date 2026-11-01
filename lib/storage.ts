import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { put } from '@vercel/blob';

// Almacenamiento de entregas: disco local en desarrollo; Vercel Blob en producción.
// En Vercel la ruta se guarda como URL completa (file_path) y la descarga redirige.

const UPLOADS = path.join(process.cwd(), 'storage', 'uploads');

function blobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN || null;
}

/** Guarda un archivo entregado y devuelve file_path (nombre local o URL de Blob). */
export async function saveUpload(file: File, ext: string): Promise<string> {
  const name = crypto.randomBytes(16).toString('hex') + '.' + ext;
  const token = blobToken();
  if (token) {
    const res = await put('uploads/' + name, file, { access: 'public', token });
    return res.url;
  }
  mkdirSync(UPLOADS, { recursive: true });
  writeFileSync(path.join(UPLOADS, name), Buffer.from(await file.arrayBuffer()));
  return name;
}

/** Lee un archivo guardado para la descarga protegida (null si no existe). */
export async function readUpload(filePath: string): Promise<Buffer | null> {
  if (/^https?:\/\//i.test(filePath)) {
    const res = await fetch(filePath);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  const safe = path.basename(filePath); // como basename() del PHP: sin trayectorias
  const p = path.join(UPLOADS, safe);
  if (!existsSync(p)) return null;
  return readFileSync(p);
}

/** Validación de firma binaria (réplica de la comprobación de magic bytes del PHP). */
export function validSpreadsheet(ext: string, head8: Buffer, head2048: Buffer): boolean {
  switch (ext) {
    case 'xlsx':
      return head8.length >= 4 && head8[0] === 0x50 && head8[1] === 0x4b && head8[2] === 0x03 && head8[3] === 0x04;
    case 'xls':
      return head8.length >= 4 && head8[0] === 0xd0 && head8[1] === 0xcf && head8[2] === 0x11 && head8[3] === 0xe0;
    default:
      return !head2048.includes(0); // csv: texto
  }
}

/** Nombre original saneado (mismo patrón del PHP). */
export function safeOriginalName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[^\p{L}\p{N}\s._()-]/gu, '').slice(0, 150);
  return clean || `entrega.${ext}`;
}
