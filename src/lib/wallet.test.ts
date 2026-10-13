import { describe, expect, it } from 'vitest'
import { ed25519 } from '@noble/curves/ed25519.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { base58 } from '@scure/base'
import { evmChecksum, expectedAttempts, fromMnemonic, matches, randomWallet, validatePattern } from './wallet'

const ABANDON = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const HARDHAT = 'test test test test test test test test test test test junk'

describe('known vectors', () => {
  it('Solana m/44\'/501\'/0\'/0\' matches Phantom', () => {
    expect(fromMnemonic('solana', ABANDON).address).toBe('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk')
  })
  it('EVM m/44\'/60\'/0\'/0/0 matches MetaMask', () => {
    expect(fromMnemonic('evm', ABANDON).address).toBe('0x9858EfFD232B4033E47d90003D41EC34EcaEda94')
    const h = fromMnemonic('evm', HARDHAT)
    expect(h.address).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')
    expect(h.privateKey).toBe('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  })
})

describe('random wallets re-derive', () => {
  for (let i = 0; i < 5; i++) {
    it(`solana #${i}`, () => {
      const w = randomWallet('solana')
      expect(w.mnemonic.split(' ')).toHaveLength(24)
      expect(fromMnemonic('solana', w.mnemonic).address).toBe(w.address)
      const sk = base58.decode(w.privateKey)
      expect(base58.encode(ed25519.getPublicKey(sk.slice(0, 32)))).toBe(w.address)
      expect(base58.encode(sk.slice(32))).toBe(w.address)
      expect(Uint8Array.from(JSON.parse(w.secretKeyJson!))).toEqual(sk)
    })
    it(`evm #${i}`, () => {
      const w = randomWallet('evm')
      expect(w.mnemonic.split(' ')).toHaveLength(24)
      expect(fromMnemonic('evm', w.mnemonic).address).toBe(w.address)
      const pub = secp256k1.getPublicKey(hexToBytes(w.privateKey.slice(2)), false).slice(1)
      expect(evmChecksum(bytesToHex(keccak_256(pub).slice(-20)))).toBe(w.address)
    })
  }
})

describe('patterns', () => {
  it('validates charset', () => {
    expect(validatePattern('solana', { prefix: 'abc0', suffix: '', caseSensitive: true })).toMatch(/base58/)
    expect(validatePattern('solana', { prefix: 'abc', suffix: '', caseSensitive: true })).toBeNull()
    expect(validatePattern('evm', { prefix: 'beefz', suffix: '', caseSensitive: false })).toMatch(/hex/)
  })
  it('matches prefix/suffix and case', () => {
    expect(matches('evm', '0xDeAd00', { prefix: 'dead', suffix: '', caseSensitive: false })).toBe(true)
    expect(matches('evm', '0xDeAd00', { prefix: 'dead', suffix: '', caseSensitive: true })).toBe(false)
    expect(matches('solana', 'AbcXyz', { prefix: 'Ab', suffix: 'yz', caseSensitive: true })).toBe(true)
  })
  it('difficulty', () => {
    expect(expectedAttempts('evm', { prefix: 'de', suffix: '', caseSensitive: false })).toBe(256)
    expect(expectedAttempts('solana', { prefix: 'A', suffix: '', caseSensitive: true })).toBe(58)
  })
})
