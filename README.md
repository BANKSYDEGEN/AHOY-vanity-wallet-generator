# $AHOY Vanity Wallet Generator ☠

A [PumpFun Pirates](https://pumpfunpirates.com) themed edition of [vanity-wallet](https://github.com/BANKSYDEGEN/vanity-wallet). It uses the same crypto and worker code, restyled with the Pirates art. Images come from pumpfunpirates.com (logo, map background, wood, paper and red button), and the fonts (Just Another Hand, Poppins) come from @fontsource. Everything is bundled locally, so the page makes no remote requests.

## Vanity Wallet Generator

Generate **Solana** or **EVM** wallets whose address starts or ends with characters you choose. Every wallet comes with a **24-word BIP39 seed phrase**, so you can import it into Phantom or MetaMask.

**Live:** https://banksydegen.github.io/AHOY-vanity-wallet-generator/

## How it works
Each attempt does the following:
1. Generates 256 bits of entropy and turns it into a 24-word mnemonic (`@scure/bip39`, English).
2. Derives a seed with PBKDF2-HMAC-SHA512 (2048 rounds).
3. Derives the address:
   - **Solana:** SLIP-0010 ed25519 at `m/44'/501'/0'/0'` (Phantom's default), via `micro-key-producer/slip10` and `@noble/curves`.
   - **EVM:** BIP32 secp256k1 at `m/44'/60'/0'/0/0` (MetaMask's default), via `@scure/bip32`, `keccak_256` and an EIP-55 checksum.

The search runs in parallel, with one Web Worker per `navigator.hardwareConcurrency`. It supports a prefix and/or suffix, optional case sensitivity (EVM matches the EIP-55 checksum casing), and checks that you only typed valid characters (base58 excludes `0 O I l`; EVM is hex only).

When it finds a match you can export:
- the 24-word seed phrase,
- the private key (Solana: base58 64-byte secret key and the JSON byte array; EVM: hex),
- each one behind a reveal/copy toggle.

Seed derivation (PBKDF2) is slow: about 100 attempts/s per core. Each extra character multiplies the search time by about 58 for Solana or 16 for EVM.

## Security
- 100% client-side. There is no backend and no analytics. A Content-Security-Policy sets `connect-src 'none'`, so the page cannot make network requests.
- It uses only audited libraries from the [noble/scure](https://paulmillr.com/noble/) family. There is no custom cryptography.
- Never share your seed phrase or private key.

## Run it offline (recommended for real funds)
A computer with no internet can't leak your keys to anyone, even by accident.

1. **Download** the offline version: [AHOY-vanity-wallet-generator-offline.html](https://banksydegen.github.io/AHOY-vanity-wallet-generator/AHOY-vanity-wallet-generator-offline.html) (or use the big **Download offline version** button on the site). It's a single file with nothing to install.
2. **Disconnect** from the internet (turn off Wi-Fi or unplug the cable).
3. **Double-click** the downloaded file. It opens in your web browser.
4. **Generate** your wallet, write down the seed phrase, then close the page before you reconnect.

`npm run build` builds this file with `vite-plugin-singlefile` (`vite build --mode offline`), and the deploy publishes it next to the site.

## Develop
```bash
npm install
npm run dev
npm test      # vitest: known Phantom/MetaMask vectors and re-derivation checks
npm run build
```
Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.
