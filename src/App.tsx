import { useEffect, useRef, useState } from 'react'
import { expectedAttempts, validatePattern, type Chain, type Wallet, type WordCount } from './lib/wallet'
import logo from './assets/logo.webp'
import { drawQr, seedQrText, wipeCanvas } from './lib/qr'
import WalletWorker from './lib/worker.ts?worker&inline'

const OFFLINE_BUILD = import.meta.env.MODE === 'offline'
const OFFLINE_FILE = 'AHOY-vanity-wallet-generator-offline.html'
// SHA-256 of the offline file, injected at build time by scripts/build.mjs (online build only).
const OFFLINE_SHA256: string = import.meta.env.VITE_OFFLINE_SHA256 ?? ''

function Checksum() {
  if (OFFLINE_BUILD || !OFFLINE_SHA256) return null
  const code = 'block whitespace-pre-wrap break-all rounded bg-ink/90 p-2 font-mono text-[11px] text-white select-all'
  return (
    <div className="mt-4 text-sm">
      <p className={`${hand} text-2xl text-mahogany`}>🔏 Check the seal (SHA-256)</p>
      <p className="mt-1 text-xs"><strong>Why:</strong> a matchin' fingerprint proves yer copy be the official one and wasn't tampered with.</p>
      <code data-testid="offline-sha256" className={`${code} mt-1`}>{OFFLINE_SHA256}</code>
      <p className="mt-2 text-xs">In the folder ye downloaded to, run:</p>
      <p className="mt-1 text-xs font-semibold">Windows (PowerShell)</p>
      <code className={code}>{`Get-FileHash .\\${OFFLINE_FILE} -Algorithm SHA256`}</code>
      <p className="mt-1 text-xs font-semibold">Mac / Linux (Terminal)</p>
      <code className={code}>{`shasum -a 256 ${OFFLINE_FILE}`}</code>
      <p className="mt-1 text-xs">The result must match the code above exactly (Windows shows it in capitals; that's fine). Also published as <a className="underline" href={`${import.meta.env.BASE_URL}${OFFLINE_FILE}.sha256`}>{OFFLINE_FILE}.sha256</a>.</p>
    </div>
  )
}

const FUND_TEST = [
  'Send a tiny amount to the new address first.',
  'Restore the wallet from yer written phrase in Phantom or another wallet, ideally on a separate device, or later after clearin\' this page.',
  'Check the same address appears.',
  'Only then send more.',
]

function FundTest() {
  return (
    <div className="rounded border-4 border-double border-mahogany bg-mahogany/10 p-4">
      <p className={`${hand} text-3xl text-mahogany`}>🪙 Test before ye fund</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{FUND_TEST.map((s) => <li key={s}>{s}</li>)}</ol>
      <p className="mt-2 text-xs"><strong>Why:</strong> it proves yer paper backup be correct before any treasure depends on it.</p>
    </div>
  )
}

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

const AUTO_HIDE_MS = 60_000

// Secrets are never put on the clipboard: no Copy button, and copy/cut/context-menu/drag are blocked.
const block = (e: React.SyntheticEvent) => e.preventDefault()
const noCopy = { onCopy: block, onCut: block, onContextMenu: block, onDragStart: block, draggable: false }

function useAddressCopy(): [boolean, (v: string) => void] {
  const [copied, setCopied] = useState(false)
  return [copied, (v) => { navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1500) }]
}

// Reveal toggle that re-blurs after AUTO_HIDE_MS or whenever the tab is hidden.
function useReveal(): [boolean, (b: boolean) => void] {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(false), AUTO_HIDE_MS)
    const onVis = () => { if (document.hidden) setShow(false) }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onVis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onVis) }
  }, [show])
  return [show, setShow]
}

function Header({ label, show, setShow }: { label: string; show: boolean; setShow: (b: boolean) => void }) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className={`${hand} text-3xl text-mahogany`}>{label}</span>
      <button onClick={() => setShow(!show)} className={btn}>{show ? 'Hide' : 'Reveal'}</button>
    </div>
  )
}

const secretBox = 'select-none rounded border-2 border-mahogany/40 bg-sand/30 p-3 font-mono text-sm [-webkit-touch-callout:none] [-webkit-user-select:none]'

function Secret({ label, value }: { label: string; value: string }) {
  const [show, setShow] = useReveal()
  return (
    <div className="mt-4">
      <Header label={label} show={show} setShow={setShow} />
      <div data-secret {...noCopy} className={`break-all ${secretBox} ${show ? 'text-ink' : 'blur-sm'}`}>{value}</div>
    </div>
  )
}

function Words({ mnemonic }: { mnemonic: string }) {
  const [show, setShow] = useReveal()
  return (
    <div className="mt-4">
      <Header label={`${mnemonic.split(' ').length}-word seed phrase (BIP39)`} show={show} setShow={setShow} />
      <ol data-secret {...noCopy} className={`grid grid-cols-3 gap-2 ${secretBox} sm:grid-cols-4 ${show ? '' : 'blur-sm'}`}>
        {mnemonic.split(' ').map((w, i) => <li key={i} className="rounded bg-white/40 px-2 py-1"><span className="mr-1 text-mahogany/60">{i + 1}.</span><span className="font-semibold">{w}</span></li>)}
      </ol>
    </div>
  )
}

function QrCanvas({ text, label }: { text: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (c) drawQr(c, text).catch(() => {})
    return () => wipeCanvas(c)
  }, [text])
  return <canvas ref={ref} aria-label={label} {...noCopy} className="mx-auto block max-w-full bg-white [-webkit-touch-callout:none]" />
}

// Seed QR: not rendered at all until revealed; auto-hides like the words, and is unmounted (canvas wiped) on hide or Clear.
function SeedQr({ mnemonic }: { mnemonic: string }) {
  const [show, setShow] = useReveal()
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <span className={`${hand} text-3xl text-mahogany`}>Seed phrase QR</span>
        <button onClick={() => setShow(!show)} className={btn}>{show ? 'Hide seed QR' : 'Show seed QR'}</button>
      </div>
      <p className="mb-2 rounded bg-blood/10 p-2 text-sm font-semibold text-blood">⚠ Never photograph or screenshot this QR. It holds yer whole seed phrase. Only scan it straight into a trusted wallet, or print it on a printer that's offline.</p>
      <div data-secret {...noCopy} className={`${secretBox} flex min-h-[200px] items-center justify-center`}>
        {show
          ? <QrCanvas text={seedQrText(mnemonic)} label="Seed phrase QR code" />
          : <div aria-hidden className="h-[180px] w-[180px] bg-[repeating-linear-gradient(45deg,#0003_0_8px,transparent_8px_16px)] blur-sm" />}
      </div>
    </div>
  )
}

function AddressQr({ address }: { address: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="mt-2">
      <button onClick={() => setShow(!show)} className={btn}>{show ? 'Hide address QR' : 'Address QR'}</button>
      {show && <div className="mt-2"><QrCanvas text={address} label="Public address QR code" /></div>}
    </div>
  )
}

function AddressCopy({ address }: { address: string }) {
  const [copied, copy] = useAddressCopy()
  return <button onClick={() => copy(address)} className={btn}>{copied ? 'Copied!' : 'Copy address'}</button>
}

const SAFETY_RULES: [string, string][] = [
  ['Cut the anchor line first.', 'Before forgin\' a wallet, turn off Wi-Fi or unplug the cable, and use the downloaded offline copy. Why: with no connection, nothing on the computer can send yer seed anywhere while it be on screen.'],
  ['Ink it on paper.', 'Write the seed words on paper, by hand. Never screenshot or photograph them, never copy them to the clipboard, and never save them to the cloud, a notes app or a password manager that syncs online. Why: photos, clipboards and notes get synced and backed up, and other apps can read them. Paper can\'t be hacked.'],
  ['Never type it into a website.', 'Only type yer seed into the wallet app ye be importin\' it into. Why: any site or "support" agent askin\' for it be a thief.'],
  ['Close the hatch before sailin\' on.', 'Close this tab or app before ye go back online. Why: the wallet only lives in this page\'s memory, so closin\' it wipes it before any connection returns.'],
  ['Clean ship, no stowaways.', 'Use a clean device and turn off browser extensions (or open a fresh browser profile). Why: malware and extensions can read the screen and page; goin\' offline doesn\'t stop them seein\' it.'],
  ['Only from the official port.', 'Get this tool only from wallet.pumpfunpirates.com. Why: a tampered copy could look identical but quietly use weak randomness or save yer seed.'],
  ['The words ARE the treasure.', 'Anyone with yer seed phrase owns the wallet. Never share it with any soul, not even "support". Lose it and the treasure be gone forever: nobody, us included, can recover it.'],
  ['Big hoard? Use a vault.', 'This be an experimental tool, not for meaningful amounts. For real holdings, use a hardware wallet. This tool has not been audited by a third party.'],
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
      {online ? 'You are ONLINE. Disconnect before generating a wallet.' : 'You are offline. Good, matey: safe to forge.'}
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
  const [words, setWords] = useState<WordCount>(24)
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
      w.postMessage({ cmd: 'start', chain, pattern, words })
      workers.current.push(w)
    }
  }

  const input = 'w-full border-b-2 border-mahogany bg-transparent px-1 py-1 font-mono text-lg text-ink outline-none placeholder:text-mahogany/40 focus:border-blood'
  return (
    <div className="min-h-screen px-3 py-10">
      <h1 className={`wood mx-auto w-full max-w-4xl px-16 py-5 text-center ${hand} select-none text-5xl text-white sm:text-7xl`}>$AHOY VANITY WALLET GENERATOR</h1>
      <p data-testid="disclaimer-short" className="mx-auto mt-4 max-w-2xl rounded bg-ink/80 px-4 py-2 text-center text-sm text-white">⚠ <strong>Experimental, educational tool. Not for real funds or meaningful amounts.</strong> Sail at yer own risk: provided as is, no warranty, no liability for lost treasure. Full disclaimer at the bottom.</p>

      <div className="mx-auto mt-10 grid max-w-6xl items-start gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col items-center gap-6">
          <img src={logo} alt="PumpFun Pirates captain" className="sway w-full max-w-sm rounded-b-full border-t-[20px] border-b-8 border-t-ink border-b-blood drop-shadow-[0_10px_10px_#00000040]" />
          <div className="paper w-full max-w-sm px-5 pt-8 pb-10">
            <p className={`${hand} text-3xl text-blood`}>⚠ Guard yer treasure, matey</p>
            <p className="mt-1 text-sm">Keys be forged right here in yer browser and never leave this page: no backend, no analytics, no storage, and the page's security policy (<code>connect-src 'none'</code>) blocks it from sendin' anything out. The real danger be in the handlin', not the maths: anyone who sees yer seed phrase owns the wallet.</p>
          </div>
          <div className="paper w-full max-w-sm px-5 pt-8 pb-10">
            <p className={`${hand} text-3xl text-blood`}>🗝 Where yer wallet comes from</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              <li><strong>Brand-new, not from a list.</strong> Each wallet starts from 128 bits (12 words) or 256 bits (24 words) of fresh randomness from yer browser's secure generator (<code>crypto.getRandomValues</code>).</li>
              <li><strong>Nobody else will forge it.</strong> 12 words alone allow 2<sup>128</sup> wallets, about 340 trillion trillion trillion, so the chance anyone ever makes the same one be effectively zero.</li>
              <li><strong>Nothing be kept.</strong> It isn't saved or sent anywhere, so no one can look it up later. Lose the seed phrase and the funds be gone forever.</li>
            </ul>
          </div>
          <div className="paper w-full max-w-sm px-5 pt-8 pb-10">
            <p className={`${hand} text-3xl text-blood`}>{OFFLINE_BUILD ? '⚓ Ye be sailin\' offline' : '⚓ Safest way to use it: offline'}</p>
            <p className="mt-1 text-sm"><strong>Why offline?</strong> With no internet, nothing on the computer can send yer keys anywhere while ye work.</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li><strong>Download</strong> the offline file with the big red button below. It's one file, nothing to install.</li>
              <li><strong>Disconnect</strong> from the internet (turn off Wi-Fi or unplug the cable).</li>
              <li><strong>Double-click</strong> the downloaded file. It opens in yer web browser.</li>
              <li><strong>Generate</strong> yer wallet, write the seed phrase on paper, then close the page before reconnectin'.</li>
            </ol>
            {!OFFLINE_BUILD && <a href={`${import.meta.env.BASE_URL}${OFFLINE_FILE}`} download={OFFLINE_FILE} className={`red-btn ${hand} mt-4 block w-full py-4 text-center text-4xl text-white drop-shadow-[0_5px_5px_#0000005b] hover:brightness-110`}>⬇ Download offline version</a>}
            <Checksum />
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <section className="paper px-6 pt-12 pb-16 sm:px-10">
            <p className={`${hand} text-3xl`}>Chart a custom address on the Solana Seas (or EVM waters). Every attempt forges a fresh 12- or 24-word seed phrase, ready for Phantom or MetaMask.</p>
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
            <div className="mt-4">
              <p className={`${hand} text-2xl text-mahogany`}>Seed phrase length</p>
              <div className="mt-1 flex gap-3">
                {([12, 24] as WordCount[]).map((n) => (
                  <button key={n} disabled={running} aria-pressed={words === n} onClick={() => setWords(n)} className={`${hand} px-5 py-1 text-3xl ${words === n ? 'bg-blood text-white' : 'bg-mahogany/20 text-mahogany hover:bg-mahogany/30'}`}>{n} words</button>
                ))}
              </div>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-mahogany">
                <li><strong>12 words</strong> (128-bit): already impossible to brute-force, and easier to write down with less chance of a typo.</li>
                <li><strong>24 words</strong> (256-bit): extra margin for long-term or large hoards, and the usual default on hardware wallets, but twice as much to write down.</li>
                <li>Either be safe as long as it stays offline and private. Phantom and most wallets accept both; a few only import one length. Search speed is the same either way.</li>
              </ul>
            </div>
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
            <section id="result" className="paper px-6 pt-12 pb-16 sm:px-10">
              <h2 className={`${hand} text-5xl text-blood`}>☠ Treasure found after {attempts.toLocaleString()} attempts!</h2>
              <div className="mt-3 flex items-center justify-between"><p className={`${hand} text-3xl text-mahogany`}>Address (public, safe to share)</p><AddressCopy address={result.address} /></div>
              <AddressQr address={result.address} />
              <p className="break-all font-mono text-lg font-semibold">{result.address}</p>
              <p className="mt-1 text-xs text-mahogany">Derivation path {result.path} ({result.chain === 'solana' ? 'Phantom' : 'MetaMask'} default)</p>
              <div className="mt-4 space-y-3">
                <OnlineBadge />
                <SafetyChecklist title="⚠ Before ye press Reveal" />
              </div>
              <Words mnemonic={result.mnemonic} />
              <SeedQr mnemonic={result.mnemonic} />
              <Secret label={result.chain === 'solana' ? 'Private key (base58)' : 'Private key (hex)'} value={result.privateKey} />
              {result.secretKeyJson && <Secret label="Secret key JSON byte array" value={result.secretKeyJson} />}
              <p className="mt-4 text-sm font-semibold text-blood">✍ Write it on paper. Copyin' be disabled for secrets on purpose, and they hide again after 60 seconds or when ye leave this tab.</p>
              <div className="mt-4"><FundTest /></div>
              <button onClick={() => { setResult(null); setAttempts(0); setRate(0); total.current = 0 }} className={`${hand} mt-4 w-full bg-ink py-2 text-3xl text-white hover:brightness-125`}>☠ Clear wallet from memory</button>
            </section>
          )}
        </div>
      </div>
      <footer className={`wood mx-auto mt-12 w-full max-w-xl px-10 py-3 text-center ${hand} text-2xl text-white`}>
        PumpFun Pirates · built with audited noble/scure crypto · <a className="underline" href="https://github.com/BANKSYDEGEN/AHOY-vanity-wallet-generator">Source</a>
      </footer>
      <p data-testid="disclaimer" className="paper mx-auto mt-4 max-w-3xl px-6 pt-8 pb-10 text-xs">Disclaimer: This is an experimental, educational tool. It is not intended for real funds or meaningful amounts. Use it at your own risk. It is provided "as is", without warranty of any kind, express or implied. The author and maintainers (BANKSYDEGEN) accept no liability for any loss of funds, damages, or legal consequences arising from its use. Nothing here is financial, legal, or security advice. You are responsible for complying with the laws that apply to you.</p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-mahogany/15 p-2"><p className="font-hand text-xl leading-none text-mahogany">{label}</p><p className="font-mono text-sm font-semibold">{value}</p></div>
}
