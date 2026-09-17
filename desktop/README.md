# PythonShell desktop

Thin Electron window around the static PythonShell playground. The website is unchanged: this app serves the same `index.html` and `static/` files over a stable `pythonshell://app/` origin so Web Workers work and `localStorage` persists across launches.

The workspace is **not** stored as real disk files. Upload/download still use the in-page file picker, same as [shell.py4e.com](https://shell.py4e.com/). First launch needs internet so Pyodide can load from jsDelivr; later launches reuse Chromium’s cache.

Interactive `input()` needs Chromium JSPI (WebAssembly stack switching). The app enables that at launch (`WebAssemblyExperimentalJSPI`) and uses Electron 37+ (Chromium 138), where JSPI is on by default.

## Run from source

Requires Node.js 20+.

```bash
cd desktop
npm install
npm start
```

The window loads the files in the parent directory (`../index.html`, `../static/`), so you can edit the playground and reload.

`npm start` still shows as **Electron** in the macOS dock because it launches the Electron binary. Packaged installers are named **PythonShell**.

Electron keeps its own profile, so the desktop workspace is separate from Chrome/Firefox `localStorage`.

## Build installers

From `desktop/`:

```bash
npm run dist        # current OS
npm run dist:mac    # macOS .dmg (universal) — GitHub releases, unsigned
npm run dist:mas    # Mac App Store .pkg (universal, sandboxed; needs Apple certs)
npm run dist:win    # Windows NSIS .exe and AppX/MSIX
npm run dist:linux  # Linux AppImage
```

Output is written to `desktop/dist/`.

Tagged releases (`v0.9.3`, …) are built for Mac, Windows, and Linux by `.github/workflows/release.yml`.

## macOS Gatekeeper (Sequoia and Tahoe)

The Mac `.dmg` is **not signed or notarized**. On Tahoe, Gatekeeper shows “PythonShell Not Opened” (Apple could not verify it) and often **moves the app to the Trash**.

1. Drag `PythonShell.app` out of Trash into `/Applications`.
2. Clear the download quarantine and open it:

```bash
xattr -cr /Applications/PythonShell.app
open /Applications/PythonShell.app
```

Alternatively: System Settings → Privacy & Security → **Open Anyway**.

Right-click → Open does **not** work on Sequoia/Tahoe. The lasting fix is an Apple Developer ID and notarization.

## Mac App Store

`npm run dist:mas` builds a sandboxed universal `.pkg` for App Store Connect (`com.learnxp.pythonshell`). It is **not** part of the default GitHub tag build (that stays an unsigned `.dmg`).

The App Store Connect **Mac** app record must use that same bundle ID. Transporter matches the `.pkg` to the listing by bundle ID only. Creating certs in the browser is not enough: both identities must be in Keychain, and the provisioning profile must be a file at `desktop/build/embedded.provisionprofile`.

### Apple certificates

You create these in the [Apple Developer certificates list](https://developer.apple.com/account/resources/certificates/list) (Apple Developer Program required). GitHub does not issue them.

Apple will ask you to **Upload a Certificate Signing Request**. Make that file on a Mac first (one CSR can be reused for both certs):

1. Open **Keychain Access**.
2. Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority…**
3. User Email Address: your Apple ID email. Common Name: something like `Dr. Chuck`. CA Email Address: leave empty. Choose **Saved to disk**. Continue, save `CertificateSigningRequest.certSigningRequest` (Desktop is fine).
4. Back in the Apple Developer form, upload that `.certSigningRequest`.

Then create **two** certificates, uploading the same CSR for each. Download each `.cer` and double-click so it installs in the **login** keychain (not System Roots):

1. **Mac App Distribution** — shows in Keychain as `3rd Party Mac Developer Application`. Signs `PythonShell.app`.
2. **Mac Installer Distribution** — shows as `3rd Party Mac Developer Installer`. Signs the `.pkg`. Without this, the build stops after signing the app: `Cannot find valid "3rd Party Mac Developer Installer" identity`.

Confirm both (two lines: one Application, one Installer). Do **not** create a second Mac App Distribution certificate — `codesign` then fails with **ambiguous**. If that happens, in Keychain Access delete only the extra *certificate* (not the private key). `security delete-identity` can remove the shared CSR key and break both certs.

```bash
security find-identity -v -p basic | grep '3rd Party Mac Developer'
```

### Provisioning profile

[Profiles](https://developer.apple.com/account/resources/profiles/list) → **+**. Under **Distribution**, pick **Mac App Store Connect**.

Do **not** pick:

- **macOS App Development** — local test Macs only
- **App Store Connect** — iPhone/iPad
- **Developer ID** — notarized `.dmg` outside the Store

Then: App ID `com.learnxp.pythonshell` → Mac App Distribution certificate → Generate → **Download**.

Save the file into the repo (Apple’s download name does not matter). Do not only create it on the website, and do not double-click it “to install”:

```bash
mkdir -p desktop/build
cp ~/Downloads/*.provisionprofile desktop/build/embedded.provisionprofile
```

That path is gitignored. `npm run dist:mas` refuses to run if the file is missing. Transporter rejects a `.pkg` without it (errors 90889 / 90287: missing profile, `com.apple.application-identifier` / `com.apple.developer.team-identifier`).

### Local MAS build

Certs in Keychain, profile at `desktop/build/embedded.provisionprofile`:

```bash
cd desktop
npm run dist:mas
```

The signing line must show a profile path, not `provisioningProfile=none`. The Transporter upload is `desktop/dist/mas-universal/PythonShell-0.9.3-mac-universal.pkg` (not the `.app`, not the GitHub `.dmg`). Open **Transporter** from the Mac App Store, sign in as the same Apple ID that owns the App Store Connect app, drag that `.pkg`, Deliver.

For CI `.p12` exports: in **Keychain Access**, select the Mac App Distribution identity → Export → `.p12`. Set a password. Repeat for the Installer identity.

For CI, encode the files and add **repository secrets** (Settings → Secrets and variables → Actions):

```bash
base64 -i MacAppDistribution.p12 | pbcopy          # MAC_CSC_LINK
base64 -i MacInstallerDistribution.p12 | pbcopy    # MAC_CSC_INSTALLER_LINK
base64 -i embedded.provisionprofile | pbcopy       # MAC_PROVISION_PROFILE_BASE64
```

| Secret | Value |
| --- | --- |
| `MAC_CSC_LINK` | base64 of the app `.p12` |
| `MAC_CSC_KEY_PASSWORD` | password used when exporting that `.p12` |
| `MAC_CSC_INSTALLER_LINK` | base64 of the installer `.p12` |
| `MAC_CSC_INSTALLER_KEY_PASSWORD` | that export password |
| `MAC_PROVISION_PROFILE_BASE64` | base64 of the `.provisionprofile` |

Until `MAC_CSC_LINK` is set, the Mac App Store job on a `v*` tag is skipped. After it is set, CI attaches a `.pkg` **workflow artifact** (not the public GitHub release). Upload that `.pkg` with **Transporter**.

Do not commit `.p12` or `.provisionprofile` files.

`npm run dist:mas:dev` is the same sandbox with a development cert, for local testing. Listing and review notes: [`store/apple/listing.md`](store/apple/listing.md).

## Windows SmartScreen

Windows SmartScreen may warn on the unsigned `.exe`. The tagged Windows build also includes an unsigned `.msix` (same package as AppX). Sideload it in Developer Mode:

```powershell
Add-AppxPackage .\PythonShell-0.9.3-win-x64.msix
```

Without a signing certificate, MSIX will not install on a stock Windows machine the way the NSIS `.exe` does. The Store would re-sign it if this app is ever submitted there.
