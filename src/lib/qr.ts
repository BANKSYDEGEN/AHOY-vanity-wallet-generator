import QRCode from 'qrcode'

// QR options shared by the UI and tests. Rendered locally; no network involved.
export const QR_OPTS = { errorCorrectionLevel: 'M' as const, margin: 2, width: 280, color: { dark: '#000000', light: '#ffffff' } }

/** The QR payload for a seed phrase: the words, single-space separated. */
export const seedQrText = (mnemonic: string) => mnemonic.trim().split(/\s+/).join(' ')

export const drawQr = (canvas: HTMLCanvasElement, text: string) => QRCode.toCanvas(canvas, text, QR_OPTS)

export const wipeCanvas = (canvas: HTMLCanvasElement | null) => {
  if (!canvas) return
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  canvas.width = canvas.height = 0
}
