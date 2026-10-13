// Key generation & derivation. Only audited libraries (paulmillr's noble/scure family) are used.
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { HDKey } from '@scure/bip32'
import { HDKey as SlipHDKey } from 'micro-key-producer/slip10.js'
import { ed25519 } from '@noble/curves/ed25519.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex } from '@noble/hashes/utils.js'
import { base58 } from '@scure/base'

export type Chain = 'solana' | 'evm'
export const SOL_PATH = "m/44'/501'/0'/0'" // Phantom default
export const EVM_PATH = "m/44'/60'/0'/0/0" // MetaMask default

export interface Wallet {
  chain: Chain
  mnemonic: string
  path: string
  address: string
  /** Solana: base58 64-byte secret key. EVM: 0x hex private key. */
  privateKey: string
  /** Solana only: JSON byte array (Phantom / solana-keygen importable) */
  secretKeyJson?: string
}

export function evmChecksum(addrLowerNo0x: string): string {
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addrLowerNo0x)))
  let out = ''
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? addrLowerNo0x[i].toUpperCase() : addrLowerNo0x[i]
  return '0x' + out
}

export function fromMnemonic(chain: Chain, mnemonic: string): Wallet {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error('invalid mnemonic')
  const seed = mnemonicToSeedSync(mnemonic) // PBKDF2-HMAC-SHA512, 2048 rounds (the slow part)
  if (chain === 'solana') {
    const key = SlipHDKey.fromMasterSeed(seed).derive(SOL_PATH)
    const sk = key.privateKey
    const pk = ed25519.getPublicKey(sk)
    const full = new Uint8Array(64)
    full.set(sk, 0)
    full.set(pk, 32)
    return { chain, mnemonic, path: SOL_PATH, address: base58.encode(pk), privateKey: base58.encode(full), secretKeyJson: JSON.stringify(Array.from(full)) }
  }
  const key = HDKey.fromMasterSeed(seed).derive(EVM_PATH)
  const sk = key.privateKey!
  const pub = secp256k1.getPublicKey(sk, false).slice(1)
  const lower = bytesToHex(keccak_256(pub).slice(-20))
  return { chain, mnemonic, path: EVM_PATH, address: evmChecksum(lower), privateKey: '0x' + bytesToHex(sk) }
}

/** One attempt: fresh 256-bit entropy → 24 words → derived address. */
export function randomWallet(chain: Chain): Wallet {
  return fromMnemonic(chain, generateMnemonic(wordlist, 256))
}

export const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export const HEX = '0123456789abcdefABCDEF'

export interface Pattern { prefix: string; suffix: string; caseSensitive: boolean }

export function validatePattern(chain: Chain, p: Pattern): string | null {
  const allowed = chain === 'solana' ? BASE58 : HEX
  for (const ch of p.prefix + p.suffix) {
    if (!allowed.includes(ch)) return chain === 'solana' ? `"${ch}" is not base58 (0, O, I and l are not allowed)` : `"${ch}" is not hex (0-9, a-f)`
  }
  if (!p.prefix && !p.suffix) return 'Enter a prefix or suffix'
  return null
}

/** Address body that the pattern is matched against (EVM strips 0x). */
export function matches(chain: Chain, address: string, p: Pattern): boolean {
  let a = chain === 'evm' ? address.slice(2) : address
  let { prefix, suffix } = p
  if (!p.caseSensitive) { a = a.toLowerCase(); prefix = prefix.toLowerCase(); suffix = suffix.toLowerCase() }
  return a.startsWith(prefix) && a.endsWith(suffix)
}

/** Expected attempts (1/probability) for a pattern. Approximate for base58 case-insensitive. */
export function expectedAttempts(chain: Chain, p: Pattern): number {
  let n = 1
  for (const ch of p.prefix + p.suffix) {
    if (chain === 'solana') {
      const hasPair = /[a-zA-Z]/.test(ch) && BASE58.includes(ch.toLowerCase()) && BASE58.includes(ch.toUpperCase())
      n *= p.caseSensitive || !hasPair ? 58 : 29
    } else {
      // checksum casing: letters a-f have ~1/2 chance of being the requested case
      n *= 16 * (p.caseSensitive && /[a-fA-F]/.test(ch) ? 2 : 1)
    }
  }
  return n
}
