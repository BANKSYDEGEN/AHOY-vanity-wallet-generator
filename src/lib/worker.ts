/// <reference lib="webworker" />
import { matches, randomWallet, type Chain, type Pattern } from './wallet'

let running = false
self.onmessage = (e: MessageEvent<{ cmd: 'start'; chain: Chain; pattern: Pattern } | { cmd: 'stop' }>) => {
  const m = e.data
  if (m.cmd === 'stop') { running = false; return }
  running = true
  let count = 0
  const loop = () => {
    if (!running) return
    const end = performance.now() + 100
    while (performance.now() < end) {
      const w = randomWallet(m.chain)
      count++
      if (matches(m.chain, w.address, m.pattern)) {
        running = false
        self.postMessage({ type: 'found', wallet: w, count })
        return
      }
    }
    self.postMessage({ type: 'progress', count })
    count = 0
    setTimeout(loop, 0) // yield so 'stop' messages are processed
  }
  loop()
}
