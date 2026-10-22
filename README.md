# $AHOY Vanity Wallet Generator ☠

> ⚠ **Experimental, educational tool. Not for real funds or meaningful amounts. Use at your own risk.** Provided as is, with no warranty. See the [Disclaimer](#disclaimer).

A [PumpFun Pirates](https://pumpfunpirates.com) themed edition of [vanity-wallet](https://github.com/BANKSYDEGEN/vanity-wallet). It uses the same crypto and worker code, restyled with the Pirates art. Images come from pumpfunpirates.com (logo, map background, wood, paper and red button), and the fonts (Just Another Hand, Poppins) come from @fontsource. Everything is bundled locally, so the page makes no remote requests.

## Vanity Wallet Generator

Generate **Solana** or **EVM** wallets whose address starts or ends with characters you choose. Every wallet comes with a **12- or 24-word BIP39 seed phrase** (your choice; 24 is the default), so you can import it into Phantom or MetaMask.

**Live:** https://wallet.pumpfunpirates.com/

## 12 or 24 words?
- **12 words (128-bit):** already effectively impossible to brute-force, and easier to write down and back up with less chance of a typo.
- **24 words (256-bit, default):** extra margin for long-term or large holdings and the usual default on hardware wallets, but twice as much to write down.
- Either is safe as long as it stays offline and private. Phantom and most wallets import both; a few only accept one length.
- Search speed is the same: each attempt's cost is dominated by PBKDF2 seed derivation, which doesn't depend on phrase length.

## How it works
Each attempt does the following:
1. Generates 128 bits (12 words) or 256 bits (24 words) of entropy and turns it into a mnemonic (`@scure/bip39`, English).
2. Derives a seed with PBKDF2-HMAC-SHA512 (2048 rounds).
3. Derives the address:
   - **Solana:** SLIP-0010 ed25519 at `m/44'/501'/0'/0'` (Phantom's default), via `micro-key-producer/slip10` and `@noble/curves`.
   - **EVM:** BIP32 secp256k1 at `m/44'/60'/0'/0/0` (MetaMask's default), via `@scure/bip32`, `keccak_256` and an EIP-55 checksum.

The search runs in parallel, with one Web Worker per `navigator.hardwareConcurrency`. It supports a prefix and/or suffix, optional case sensitivity (EVM matches the EIP-55 checksum casing), and checks that you only typed valid characters (base58 excludes `0 O I l`; EVM is hex only).

When it finds a match you can export:
- the 12- or 24-word seed phrase,
- the private key (Solana: base58 64-byte secret key and the JSON byte array; EVM: hex),
- each one behind a **Reveal** toggle (no Copy button: secrets can't be copied, cut, dragged or right-clicked, and they re-blur after 60 s or when you switch tabs). Write them on paper.

**Seed QR:** a hidden-by-default **Show seed QR** option draws the seed words (space-separated) as a QR code with the bundled [`qrcode`](https://www.npmjs.com/package/qrcode) library on a local canvas. There are no network calls and the CSP is unchanged. It has the same protections as the words: nothing is drawn until you reveal it, it hides again after 60 s or when you leave the tab, right-click/drag/save are blocked, and **Clear** wipes it. **Never photograph or screenshot it**; only scan it straight into a trusted wallet or print it on an offline printer. The public address has its own QR, which is safe to share.

Only the public address has a Copy button. **Clear wallet from memory** wipes the result from the page.

Seed derivation (PBKDF2) is slow: about 100 attempts/s per core. Each extra character multiplies the search time by about 58 for Solana or 16 for EVM.

## Where your wallet comes from
- **Brand-new, not picked from a list.** Each attempt draws 128 bits (12 words) or 256 bits (24 words) of fresh randomness from the browser's `crypto.getRandomValues` (via `@scure/bip39` → `@noble/hashes` `randomBytes`).
- **Nobody else will generate it.** 12 words alone allow 2^128 (about 3.4 × 10^38, or 340 trillion trillion trillion) possible wallets; 24 words allow 2^256. The chance anyone ever generates the same one is effectively zero.
- **Nothing is stored or sent.** The code uses no storage (no localStorage, cookies or IndexedDB) and makes no network requests, and the CSP sets `connect-src 'none'`. The wallet exists only in the open page, so nobody can look it up again: **if you lose the seed phrase, the funds are gone forever.**
- **The real risk is handling, not math.** Anyone who sees the seed phrase controls the wallet. It leaks through screenshots, cloud-synced notes, the clipboard, malware or extensions, and tampered copies of this site. That's why the rules below exist.

## ☠ The Pirate's Code: stay safe with your treasure
Read this before ye generate a wallet.

1. **Cut the anchor line first.** Turn off Wi-Fi or unplug the cable *before* you generate a wallet, and use the downloaded offline copy (see below). *Why:* with no connection, nothing on the computer can send your seed anywhere while it's on screen.
2. **Ink it on paper.** Write the seed words on paper, by hand. **Never** screenshot or photograph them, copy them to the clipboard, or save them to the cloud, a notes app, or a password manager that syncs online. *Why:* photos, clipboards and notes get synced and backed up, and other apps can read them. Paper can't be hacked.
3. **Never type it into a website.** Only enter your seed into the wallet app you're importing it into. *Why:* any site or "support" agent asking for it is a thief.
4. **Close the hatch before sailing on.** Close the tab or app *before* you reconnect to the internet. *Why:* the wallet only lives in the page's memory, so closing it wipes it before any connection returns.
5. **Clean ship, no stowaways.** Use a clean device and disable browser extensions (or use a fresh browser profile). *Why:* malware and extensions can read the screen and the page, and going offline doesn't stop that.
6. **Only from the official port.** Get the site or offline file only from `https://wallet.pumpfunpirates.com/`. *Why:* a tampered copy could look identical but quietly use weak randomness or save your seed.
7. **The words ARE the treasure.** Anyone with your seed phrase owns the wallet. Never share it with anyone, including "support". Lose it and the funds are gone forever: nobody can recover it.
8. **Big hoard? Use a vault.** This is an experimental tool, not for meaningful amounts. For real holdings, use a hardware wallet. This tool has **not** been audited by a third party (the crypto libraries it uses are audited; this app is not).

The app shows this checklist next to the **Hunt for Treasure** button and again on the result screen before you reveal anything, along with a live online/offline indicator (red while you're online, green once you're offline).

## Security
- 100% client-side. There is no backend, no analytics and no storage. A Content-Security-Policy sets `connect-src 'none'`, so the page cannot send data out (fetch, XHR, WebSocket, beacons).
- It uses only audited libraries from the [noble/scure](https://paulmillr.com/noble/) family. There is no custom cryptography.
- Never share your seed phrase or private key.

## Run it offline (the safest way to use it)
With no internet, nothing on the computer can send your keys anywhere while you work.

1. **Download** the offline version: [AHOY-vanity-wallet-generator-offline.html](https://wallet.pumpfunpirates.com/AHOY-vanity-wallet-generator-offline.html) (or use the big **Download offline version** button on the site). It's a single file with nothing to install.
2. **Disconnect** from the internet (turn off Wi-Fi or unplug the cable).
3. **Double-click** the downloaded file. It opens in your web browser.
4. **Generate** your wallet, write the seed phrase down on paper, then close the page before you reconnect.

`npm run build` builds this file with `vite-plugin-singlefile` (`vite build --mode offline`), and the deploy publishes it next to the site.


### Check the seal (SHA-256)
The build publishes the offline file's fingerprint next to it: [AHOY-vanity-wallet-generator-offline.html.sha256](https://wallet.pumpfunpirates.com/AHOY-vanity-wallet-generator-offline.html.sha256). The site shows the same hash under the Download button. *Why:* if your file's hash matches, your copy is the official one and wasn't tampered with.

In the folder you downloaded to, run:
```powershell
# Windows (PowerShell)
Get-FileHash .\AHOY-vanity-wallet-generator-offline.html -Algorithm SHA256
```
```bash
# Mac / Linux
shasum -a 256 AHOY-vanity-wallet-generator-offline.html
```
The output must match the published hash exactly (PowerShell prints it in capitals, which is fine). The offline file can't show its own hash, so check it against the website or the `.sha256` file. `scripts/build.mjs` builds the offline file first, hashes it, then builds the site with that hash baked in (the CSP blocks fetching it at runtime), and publishes the file byte-for-byte.

## 🪙 Test before you fund
1. Send a tiny amount to the new address first.
2. Restore the wallet from your written phrase in Phantom or another wallet, ideally on a separate device, or later after clearing the page.
3. Confirm the same address appears.
4. Only then send more.

*Why:* it proves your paper backup is correct before money depends on it. The app shows these steps on the result screen.

## Develop
```bash
npm install
npm run dev
npm test      # vitest: known Phantom/MetaMask vectors and re-derivation checks
npm run build
```
Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Disclaimer
This is an experimental, educational tool. It is not intended for real funds or meaningful amounts. Use it at your own risk. It is provided "as is", without warranty of any kind, express or implied. The author and maintainers (BANKSYDEGEN) accept no liability for any loss of funds, damages, or legal consequences arising from its use. Nothing here is financial, legal, or security advice. You are responsible for complying with the laws that apply to you.
