import { describe, expect, it } from 'vitest';
import { wavBytes } from '../src/export/wav';

const str = (v: DataView, o: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(o + i)));

describe('wavBytes', () => {
  const buf = wavBytes([new Float32Array([0, 1, -1, 0.5]), new Float32Array([0, 0, 0, 0])], 44100);
  const v = new DataView(buf);

  it('writes a valid RIFF/WAVE header', () => {
    expect(str(v, 0, 4)).toBe('RIFF');
    expect(str(v, 8, 4)).toBe('WAVE');
    expect(str(v, 12, 4)).toBe('fmt ');
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(str(v, 36, 4)).toBe('data');
  });

  it('sizes the chunks from the frame count', () => {
    expect(buf.byteLength).toBe(44 + 4 * 2 * 2);
    expect(v.getUint32(40, true)).toBe(16);
    expect(v.getUint32(4, true)).toBe(buf.byteLength - 8);
  });

  it('interleaves channels and scales to 16-bit', () => {
    expect(v.getInt16(44, true)).toBe(0);
    expect(v.getInt16(48, true)).toBe(32767); // frame 1, left = +1
    expect(v.getInt16(52, true)).toBe(-32768); // frame 2, left = -1
    expect(v.getInt16(50, true)).toBe(0); // frame 1, right
  });

  it('clips values outside -1..1', () => {
    const c = new DataView(wavBytes([new Float32Array([3, -3])], 8000));
    expect(c.getInt16(44, true)).toBe(32767);
    expect(c.getInt16(46, true)).toBe(-32768);
  });
});
