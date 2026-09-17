# Mac App Store listing — PythonShell

Copy these fields into [App Store Connect](https://appstoreconnect.apple.com/). This is a **Mac** app (not iPhone/iPad). The product is the same playground as [shell.py4e.com](https://shell.py4e.com/).

The **0.9.3** listing you already submitted said the first launch downloads Pyodide from jsDelivr. The **0.9.4** app includes that runtime. Do not leave the old download language in Connect — it will look like an apology for something the binary no longer does.

### Where to fix it in App Store Connect

Open the PythonShell Mac app → the **in-flight / 1.0** version (or create a new version for 0.9.4). Paste from this file. Fields that likely still have the old network/CDN wording:

1. **Distribution → macOS version → Description** — replace with the Description below. Delete any sentence about first launch needing the internet or downloading a runtime.
2. **What’s New** — use the 0.9.4 text below (runtime included in the app).
3. **App Review Information → Notes** (sidebar **App Review**, or the Notes box on the version page) — replace with the review notes below. If you already answered Guideline 2.1 in **Resolution Center** with jsDelivr / “allow the first launch to use the network,” send a short follow-up: the new build bundles Pyodide; testers do not need the network to press Run.
4. **App Privacy** (left sidebar) — keep **Data Not Collected**. If a privacy answer or free-text note mentioned downloading Pyodide from a CDN, edit it. Optional network: Help can open www.py4e.com; that is not tracking.
5. **Privacy Policy URL** — still `https://shell.py4e.com/privacy.html`. Deploy the repo `privacy.html` so the live page says the desktop app includes the runtime (the website still uses the CDN).
6. **Screenshot captions** — `hello.py` / hello py4e, not the old `input()` name prompt unless you still want that as a second shot.

Promotional text, subtitle, keywords, and support URL did not mention the download. Leave them unless you want a refresh.

Apple will not accept the unsigned GitHub `.dmg`. Use a sandboxed `mas` `.pkg` and a privacy-policy URL that is live on the web.


## Name (≤30)

PythonShell

## Subtitle (≤30)

A Python playground

## Promotional text (≤170, optional)

A free Python playground from Python for Everybody. Edit files, press Run, and use a small Linux-like shell. No account. Python runs on your Mac.

## Description (≤4000)

PythonShell is a simple Python playground from Python for Everybody. Open it and start coding. There is no login, no course launch, and no grading.

Write Python in a multi-file editor, press Run, and see the result in a small Linux-like shell. The same shell understands commands such as python main.py, ls, rm, help, upload, and download. When a program calls input(), type the answer at the shell prompt.

Python 3.12 runs on your Mac inside the app (Pyodide). The runtime is included in the app. Your code is not sent to a server to be executed. Work is saved only on this Mac. Clearing the app’s data or resetting the workspace will lose it — that is intentional. This is a place to experiment, not an assignment drop-box.

Help can open https://www.py4e.com/ in your browser. The web version is at https://shell.py4e.com/

WHAT YOU CAN DO

• Edit several files in tabs (create, rename, delete, upload, download)
• Run the current file, or type python file.py in the shell
• See print output, errors, and tracebacks
• Answer input() prompts in the shell
• Stop a runaway program (the runtime times out and restarts)
• Reset the workspace to the starter files (hello.py, main.py, about.txt, romeo.txt, mbox-short.txt)

WHAT IT IS NOT

• Not a full Linux terminal (no pipes, redirects, or globs)
• Not an interactive Python REPL (>>>); run a file instead
• Not a grader and not connected to a learning-management system
• Not a place to install extra native Python packages beyond the bundled standard library

PythonShell is provided free of charge by Python for Everybody (https://www.py4e.com/).

## Keywords (≤100, comma-separated, do not include “PythonShell”)

python,learn python,coding,education,beginner,editor,shell,py4e,playground

## What’s New

First Mac App Store release of PythonShell: a free Python playground from Python for Everybody. Edit files, press Run, and use a small Linux-like shell. Python 3.12 is included in the app; no account required.

## URLs (required)

- Support URL: https://www.py4e.com/
- Marketing URL (optional): https://shell.py4e.com/
- Privacy Policy URL: https://shell.py4e.com/privacy.html

## Category

- Primary: Education
- Secondary (optional): Developer Tools

## Age rating (suggested)

This is a general-education coding tool. Typical answers:

- No unrestricted web browsing (the window is the playground only; Help can open www.py4e.com in the system browser)
- No user-generated public content, chat, or social
- No violence, sexual content, or gambling
- Expected rating: **4+**

## App Privacy (App Store Connect questionnaire)

Developer: Python for Everybody / Dr. Chuck.

Suggested answers if you do not add analytics or accounts:

- **Data Not Collected** from the user for tracking or advertising.
- No Account, no Contact Info, no Location, no Purchases.
- The Mac app includes a pinned Python runtime (Pyodide 0.27.5). Help may open www.py4e.com in the system browser.
- Workspace files stay on the device (the app’s own storage). They are not uploaded to Python for Everybody servers.
- Upload/download of learner files happens only when the user chooses a file.

If Apple’s form asks whether the app uses data from the device that never leaves the device, that is the workspace in local storage only.

## Privacy Policy URL

https://shell.py4e.com/privacy.html

## Privacy policy (source)

The live page is [`privacy.html`](../../../privacy.html) at the site root.

## Notes for App Review (App Store Connect → App Review Information)

Paste this (also use in Resolution Center if Guideline 2.1 asks for more information on a new developer account):

PythonShell is a free education app from Python for Everybody (www.py4e.com). There is no login, no user accounts, no in-app purchase, no subscriptions, and no user-generated public content.

PURPOSE AND AUDIENCE. PythonShell is a beginner Python playground for learners in Python for Everybody and similar intro courses. The problem it solves: students can write and run Python immediately on a Mac without installing a local Python, creating an account, or joining an LMS. Value: a multi-file editor, Run, and a small Linux-like shell; Python 3.12 runs on the device (Pyodide). It is not a grader and not a full IDE.

HOW TO TEST. No credentials. (1) Launch PythonShell. The Python runtime (Pyodide 0.27.5 / Python 3.12 as WebAssembly) is included in the app. Wait until the shell is ready. Learner programs are not sent to a server. Users cannot install extra packages. (2) hello.py is focused at launch (print("hello py4e")). Press Run (or type python hello.py). The shell should print hello py4e. (3) Open main.py. Press Run. When asked for a name, type one and press Enter. The shell should print Hello plus that name. (4) Optional: ls, help, upload/download via the in-app file picker. (5) Help → About PythonShell credits Python for Everybody. Demo account: none.

EXTERNAL SERVICES. Python runs on the device from a runtime included in the app (Pyodide 0.27.5). It is not an AI API. Help may open https://www.py4e.com/ in the system browser. No authentication provider, no payments, no analytics SDK, no backend that runs student code. The editor (Ace) and UI ship inside the app. Workspace stays in the app’s local storage.

REGIONS. The app functions the same in all regions. There are no geo-restricted features or localized catalogs.

REGULATED / THIRD-PARTY CONTENT. Not a regulated industry. Sample files (hello.py, main.py, about.txt, romeo.txt, mbox-short.txt) are course materials we provide. We have the rights to ship this app and those files. Romeo text is a public-domain excerpt used for teaching.

Screen recording: launch on a physical Mac, wait for Pyodide, Run hello.py (prints hello py4e), then Run main.py and answer input(), Help → About. No login, no UGC, no paid features.

## Screenshot caption

Edit hello.py, press Run, and see hello py4e in the Linux-like shell.

Mac App Store wants 1280×800 or 1440×900 (or 2560×1600 / 2880×1800) Mac screenshots. The current Windows capture in desktop/store/microsoft/ will not meet that size/platform requirement.

## Copyright

Copyright © Python for Everybody

## Bundle / identity (already in the desktop app)

- Bundle ID: com.learnxp.pythonshell
- SKU (you choose, once): pythonshell-mac
- Price: Free

## Upload your builds using one of several tools

App Store Connect shows this until a **Mac App Store** binary is attached. Do **not** upload the GitHub `.dmg`.

You need a signed `.pkg` from electron-builder’s `mas` target. From `desktop/`, with Mac App Store certificates in the keychain (or `CSC_LINK` / `CSC_INSTALLER_LINK`):

```bash
npm run dist:mas
```

That writes a universal `.pkg` under `desktop/dist/` (name like `PythonShell-0.9.4-mas-universal.pkg`). Then use one of:

1. **Transporter** (Mac App Store) — sign in as the Apple Developer account, drag the `.pkg`, Deliver.
2. **Xcode** → Window → Organizer → Distribute App.
3. Terminal: `xcrun iTMSTransporter` (or `xcrun altool --upload-app -t osx -f PythonShell.pkg`).

Tagged GitHub releases still only attach the unsigned `.dmg`. The Store `.pkg` is a separate `dist:mas` build. Put a **Mac App Store Connect** provisioning profile at `desktop/build/embedded.provisionprofile` (not committed). See [`README.md`](../../README.md).

CI will also run `dist:mas` on tags if repository secrets `MAC_CSC_LINK` and `MAC_CSC_KEY_PASSWORD` are set, and attach the `.pkg` as a workflow artifact (not the public GitHub release).

## Packaging (not listing text, but you will hit this)

The GitHub `.dmg` is **not** a Mac App Store build. Store submission needs:

- Apple Developer Program membership
- electron-builder **mas** target, sandboxed, signed with a Mac App Distribution certificate
- Hardened runtime / entitlements for the file picker (upload/download). Network client remains so Help can open www.py4e.com. The Python runtime is included in the app.
