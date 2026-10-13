import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { QR_OPTS, seedQrText } from './qr'

const decode = async (text: string) => {
  const png = PNG.sync.read(await QRCode.toBuffer(text, QR_OPTS))
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data
}

describe('seed QR', () => {
  it('round-trips 12- and 24-word mnemonics', async () => {
    for (const bits of [128, 256]) {
      const m = generateMnemonic(wordlist, bits)
      expect(await decode(seedQrText(m))).toBe(m)
    }
  })
  it('normalises whitespace to single spaces', () => {
    expect(seedQrText('  abandon \n ability  able ')).toBe('abandon ability able')
  })
})
