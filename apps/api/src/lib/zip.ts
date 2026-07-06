/**
 * Gerador de ZIP em memória (método STORE, sem compressão) — dependency-free.
 *
 * Suficiente para a exportação ao contador: XMLs e CSVs são pequenos e os
 * sistemas contábeis importam ZIP padrão sem exigência de deflate.
 * Nomes de arquivo em UTF-8 (bit 11 do general purpose flag).
 */

export interface ZipEntry {
  /** Caminho dentro do zip, com "/" como separador (ex: "xml/saida/123.xml"). */
  name: string
  data: Uint8Array
}

// ─── CRC-32 (polinômio 0xEDB88320) ───────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// ─── Helpers de escrita little-endian ────────────────────────────────────────

class ByteWriter {
  private chunks: Uint8Array[] = []
  private len = 0

  get length(): number { return this.len }

  bytes(b: Uint8Array) { this.chunks.push(b); this.len += b.length }
  u16(v: number) { this.bytes(new Uint8Array([v & 0xff, (v >>> 8) & 0xff])) }
  u32(v: number) { this.bytes(new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])) }

  concat(): Uint8Array {
    const out = new Uint8Array(this.len)
    let off = 0
    for (const c of this.chunks) { out.set(c, off); off += c.length }
    return out
  }
}

function dosDateTime(d: Date): { date: number; time: number } {
  const year = Math.max(1980, d.getFullYear())
  return {
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  }
}

// ─── Builder ─────────────────────────────────────────────────────────────────

const FLAG_UTF8 = 0x0800
const VERSION = 20 // 2.0

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const w = new ByteWriter()
  const { date, time } = dosDateTime(new Date())
  const central: { nameBytes: Uint8Array; crc: number; size: number; offset: number }[] = []
  const enc = new TextEncoder()

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const crc = crc32(entry.data)
    const offset = w.length

    // Local file header
    w.u32(0x04034b50)
    w.u16(VERSION)
    w.u16(FLAG_UTF8)
    w.u16(0)            // método: 0 = store
    w.u16(time)
    w.u16(date)
    w.u32(crc)
    w.u32(entry.data.length) // compressed size (= uncompressed no store)
    w.u32(entry.data.length)
    w.u16(nameBytes.length)
    w.u16(0)            // extra length
    w.bytes(nameBytes)
    w.bytes(entry.data)

    central.push({ nameBytes, crc, size: entry.data.length, offset })
  }

  const cdStart = w.length

  for (const e of central) {
    w.u32(0x02014b50)
    w.u16(VERSION)      // version made by
    w.u16(VERSION)      // version needed
    w.u16(FLAG_UTF8)
    w.u16(0)            // método store
    w.u16(time)
    w.u16(date)
    w.u32(e.crc)
    w.u32(e.size)
    w.u32(e.size)
    w.u16(e.nameBytes.length)
    w.u16(0)            // extra
    w.u16(0)            // comment
    w.u16(0)            // disk
    w.u16(0)            // internal attrs
    w.u32(0)            // external attrs
    w.u32(e.offset)
    w.bytes(e.nameBytes)
  }

  const cdSize = w.length - cdStart

  // End of central directory
  w.u32(0x06054b50)
  w.u16(0)              // disk
  w.u16(0)              // disk with CD
  w.u16(central.length)
  w.u16(central.length)
  w.u32(cdSize)
  w.u32(cdStart)
  w.u16(0)              // comment length

  return w.concat()
}
