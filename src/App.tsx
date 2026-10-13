import { useEffect, useRef, useState } from 'react'
import { expectedAttempts, validatePattern, type Chain, type Wallet } from './lib/wallet'
import logo from './assets/logo.webp'
import WalletWorker from './lib/worker.ts?worker&inline'

const OFFLINE_BUILD = import.meta.env.MODE === 'offline'
const OFFLINE_FILE = 'AHOY-vanity-wallet-generator-offline.html'

const THREADS = Math.max(1, navigator.hardwareConcurrency || 4)

function fmtTime(s: number) {
  if (!isFinite(s)) return '—'
  if (s < 60) return `${s.toFixed(1)} s`
  if (s < 3600) return `${(s / 60).toFixed(1)} min`
  if (s < 86400) return `${(s / 3600).toFixed(1)} h`
  if (s < 31536000) return `${(s / 86400).toFixed(1)} days`
  return `${(s / 31536000).toExponential(1)} years`
}

const hand = 'font-hand leading-none'
const btn = `${hand} bg-mahogany px-4 py-1 text-2xl text-white hover:brightness-125 disabled:opacity-40`

function useCopy(): [boolean, (v: string) => void] {
  const [copied, setCopied] = useState(false)
  return [copied, (v) => { navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1500) }]
}

function Header({ label, show, setShow, copied, copy }: { label: string; show: boolean; setShow: (b: boolean) => void; copied: boolean; copy: () => void }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className={`${hand} text-3xl text-mahogany`}>{label}</span>
      <span className="flex gap-2">
        <button onClick={() => setShow(!show)} className={btn}>{show ? 'Hide' : 'Reveal'}</button>
        <button onClick={copy} className={btn}>{copied ? 'Copied!' : 'Copy'}</button>
      </span>
    </div>
  )
}

function Secret({ label, value }: { label: string; value: string }) {
  const [show, setShow] = useState(false)
  const [copied, copy] = useCopy()
  return (
    <div className="mt-4">
      <Header label={label} show={show} setShow={setShow} copied={copied} copy={() => copy(value)} />
      <div className={`break-all rounded border-2 border-mahogany/40 bg-sand/30 p-3 font-mono text-sm ${show ? 'text-ink' : 'select-none blur-sm'}`}>{value}</div>
    </div>
  )
}

function Words({ mnemonic }: { mnemonic: string }) {
  const [show, setShow] = useState(false)
  const [copied, copy] = useCopy()
  return (
    <div className="mt-4">
      <Header label="24-word seed phrase (BIP39)" show={show} setShow={setShow} copied={copied} copy={() => copy(mnemonic)} />
      <ol className={`grid grid-cols-3 gap-2 rounded border-2 border-mahogany/40 bg-sand/30 p-3 font-mono text-sm sm:grid-cols-4 ${show ? '' : 'select-none blur-sm'}`}>
        {mnemonic.split(' ').map((w, i) => <li key={i} className="rounded bg-white/40 px-2 py-1"><span className="mr-1 text-mahogany/60">{i + 1}.</span><span className="font-semibold">{w}</span></li>)}
      </ol>
    </div>
  )
}

const SAFETY_RULES: [string, string][] = [
  ['Cut the anchor line first.', 'Before forgin\' a wallet for real funds, turn off Wi-Fi or unplug the cable. Runnin\' the downloaded offline copy is safest.'],
  ['Ink it on paper.', 'Write the 24 words down by hand. Never screenshot or photograph them, never copy them to the clipboard, and never save them to the cloud, a notes app or a password manager that syncs online.'],
  ['Close the hatch before sailin\' on.', 'Close this tab or app before ye go back online.'],
  ['Clean ship, no stowaways.', 'Use a clean device and turn off browser extensions (or open a fresh browser profile).'],
  ['The words ARE the treasure.', 'Anyone with yer seed phrase owns the wallet. Never share it with any soul, not even "support".'],
  ['Big hoard? Use a vault.', 'For large amounts, prefer a hardware wallet. This tool has not been audited by a third party.'],
]

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}

function OnlineBadge() {
  const online = useOnline()
  return (
    <p role="status" aria-live="polite" className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold text-white ${online ? 'bg-blood' : 'bg-green-700'}`}>
      <span aria-hidden className={`inline-block h-3 w-3 rounded-full ${online ? 'animate-pulse bg-yellow-300' : 'bg-green-300'}`} />
      {online ? 'You are ONLINE. Disconnect before generating a wallet for real funds.' : 'You are offline. Good, matey: safe to forge.'}
    </p>
  )
}

function SafetyChecklist({ title }: { title: string }) {
  return (
    <div data-testid="safety-checklist" className="rounded border-4 border-double border-blood bg-blood/10 p-4">
      <p className={`${hand} text-3xl text-blood`}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {SAFETY_RULES.map(([head, body]) => (
          <li key={head} className="flex gap-2"><span aria-hidden className="text-blood">☐</span><span><strong>{head}</strong> {body}</span></li>
        ))}
      </ul>
    </div>
  )
}

export default function App() {
  const [chain, setChain] = useState<Chain>('solana')
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [running, setRunning] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [rate, setRate] = useState(0)
  const [result, setResult] = useState<Wallet | null>(null)
  const workers = useRef<Worker[]>([])
  const started = useRef(0)
  const total = useRef(0)

  const pattern = { prefix, suffix, caseSensitive }
  const error = prefix || suffix ? validatePattern(chain, pattern) : null
  const expected = expectedAttempts(chain, pattern)

  const stop = () => {
    workers.current.forEach((w) => { w.postMessage({ cmd: 'stop' }); w.terminate() })
    workers.current = []
    setRunning(false)
  }
  useEffect(() => stop, [])

  const start = () => {
    if (validatePattern(chain, pattern)) return
    stop()
    setResult(null); setAttempts(0); setRate(0)
    total.current = 0; started.current = performance.now()
    setRunning(true)
    for (let i = 0; i < THREADS; i++) {
      const w = new WalletWorker()
      w.onmessage = (e) => {
        total.current += e.data.count
        setAttempts(total.current)
        setRate(total.current / ((performance.now() - started.current) / 1000))
        if (e.data.type === 'found') { setResult(e.data.wallet); stop() }
      }
      w.postMessage({ cmd: 'start', chain, pattern })
      workers.current.push(w)
    }
  }

  const input = 'w-full border-b-2 border-mahogany bg-transparent px-1 py-1 font-mono text-lg text-ink outline-none placeholder:text-mahogany/40 focus:border-blood'
  return (
    <div className="min-h-screen px-3 py-10">
      <h1 className={`wood mx-auto w-full max-w-4xl px-16 py-5 text-center ${hand} select-none text-5xl text-white sm:text-7xl`}>$AHOY VANITY WALLET GENERATOR</h1>

      <div className="mx-auto mt-10 grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col items-center gap-6">
          <img src={logo} alt="PumpFun Pirates captain" className="sway w-full max-w-sm rounded-b-full border-t-[20px] border-b-8 border-t-ink border-b-blood drop-shadow-[0_10px_10px_#00000040]" />
          <div className="paper w-full max-w-sm p-5">
            <p className={`${hand} text-3xl text-blood`}>⚠ Guard yer treasure, matey</p>
            <p className="mt-1 text-sm">Keys be forged right here in yer browser and never leave this page: no backend, no analytics, no network calls. Never share yer seed phrase or private key with any soul, and stow it somewhere safe.</p>
          </div>
          <div className="paper w-full max-w-sm p-5">
            <p className={`${hand} text-3xl text-blood`}>{OFFLINE_BUILD ? '⚓ Ye be sailin\' offline' : '⚓ For real booty, go offline'}</p>
            <p className="mt-1 text-sm"><strong>Why offline?</strong> A computer with no internet can't leak yer keys to anyone, even by accident.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li><strong>Download</strong> the offline file with the big red button below. It's one file, nothing to install.</li>
              <li><strong>Disconnect</strong> from the internet (turn off Wi-Fi or unplug the cable).</li>
              <li><strong>Double-click</strong> the downloaded file. It opens in yer web browser.</li>
              <li><strong>Generate</strong> yer wallet, write the seed phrase on paper, then close the page before reconnectin'.</li>
            </ol>
            {!OFFLINE_BUILD && <a href={`${import.meta.env.BASE_URL}${OFFLINE_FILE}`} download={OFFLINE_FILE} className={`red-btn ${hand} mt-4 block w-full py-4 text-center text-4xl text-white drop-shadow-[0_5px_5px_#0000005b] hover:brightness-110`}>⬇ Download offline version</a>}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <section className="paper px-6 py-6 sm:px-10">
            <p className={`${hand} text-3xl`}>Chart a custom address on the Solana Seas (or EVM waters). Every attempt forges a fresh 24-word seed phrase, ready for Phantom or MetaMask.</p>
            <div className="mt-4 flex gap-3">
              {(['solana', 'evm'] as Chain[]).map((c) => (
                <button key={c} disabled={running} onClick={() => setChain(c)} className={`${hand} px-5 py-1 text-3xl ${chain === c ? 'bg-blood text-white' : 'bg-mahogany/20 text-mahogany hover:bg-mahogany/30'}`}>{c === 'solana' ? 'Solana' : 'EVM (ETH, Base…)'}</button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={`${hand} text-2xl text-mahogany`}>Prefix{chain === 'evm' && ' (after 0x)'}<input className={input} value={prefix} disabled={running} onChange={(e) => setPrefix(e.target.value.trim())} placeholder={chain === 'solana' ? 'e.g. AHoY' : 'e.g. dead'} /></label>
              <label className={`${hand} text-2xl text-mahogany`}>Suffix<input className={input} value={suffix} disabled={running} onChange={(e) => setSuffix(e.target.value.trim())} placeholder="optional" /></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={caseSensitive} disabled={running} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-blood" />
              Case-sensitive{chain === 'evm' && ' (match EIP-55 checksum casing)'}
            </label>
            <p className="mt-1 text-xs text-mahogany">{chain === 'solana' ? 'Base58: 1-9, A-Z, a-z excluding 0, O, I and l.' : 'Hex only: 0-9, a-f.'}</p>
            {error && <p className="mt-2 text-sm font-semibold text-blood">{error}</p>}

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Odds" value={`1 in ${Math.round(expected).toLocaleString()}`} />
              <Stat label="Est. time (50%)" value={rate ? fmtTime((expected * Math.LN2) / rate) : '—'} />
              <Stat label="Attempts" value={attempts.toLocaleString()} />
              <Stat label="Speed" value={`${Math.round(rate).toLocaleString()}/s`} />
            </div>
            <p className="mt-3 text-xs text-mahogany">Each attempt runs BIP39 seed derivation (PBKDF2, 2048 rounds), far slower than raw key generation. Every extra character makes the hunt about {chain === 'solana' ? '58×' : '16×'} longer, so prefixes over 4–5 characters can take hours or days. Crew of {THREADS} worker threads.</p>

            <div className="mt-5 space-y-3">
              <OnlineBadge />
              <SafetyChecklist title="☠ Pirate's Code: read before ye hunt" />
              {running
                ? <button onClick={stop} className={`${hand} w-full bg-mahogany py-2 text-4xl text-white hover:brightness-125`}>Drop anchor (Stop)</button>
                : <button onClick={start} disabled={!!error || (!prefix && !suffix)} className={`red-btn ${hand} w-full py-4 text-4xl text-white drop-shadow-[0_5px_5px_#0000005b] hover:brightness-110 disabled:opacity-50`}>Hunt for Treasure</button>}
            </div>
          </section>

          {result && (
            <section id="result" className="paper px-6 py-6 sm:px-10">
              <h2 className={`${hand} text-5xl text-blood`}>☠ Treasure found after {attempts.toLocaleString()} attempts!</h2>
              <p className={`${hand} mt-3 text-3xl text-mahogany`}>Address</p>
              <p className="break-all font-mono text-lg font-semibold">{result.address}</p>
              <p className="mt-1 text-xs text-mahogany">Derivation path {result.path} ({result.chain === 'solana' ? 'Phantom' : 'MetaMask'} default)</p>
              <div className="mt-4 space-y-3">
                <OnlineBadge />
                <SafetyChecklist title="⚠ Before ye press Reveal" />
              </div>
              <Words mnemonic={result.mnemonic} />
              <Secret label={result.chain === 'solana' ? 'Private key (base58)' : 'Private key (hex)'} value={result.privateKey} />
              {result.secretKeyJson && <Secret label="Secret key JSON byte array" value={result.secretKeyJson} />}
            </section>
          )}
        </div>
      </div>
      <footer className={`wood mx-auto mt-12 w-full max-w-xl px-10 py-3 text-center ${hand} text-2xl text-white`}>
        PumpFun Pirates · built with audited noble/scure crypto · <a className="underline" href="https://github.com/BANKSYDEGEN/AHOY-vanity-wallet-generator">Source</a>
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-mahogany/15 p-2"><p className="font-hand text-xl leading-none text-mahogany">{label}</p><p className="font-mono text-sm font-semibold">{value}</p></div>
}
