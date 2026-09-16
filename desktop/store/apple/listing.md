# Mac App Store listing — PythonShell

Copy these fields into [App Store Connect](https://appstoreconnect.apple.com/). This is a **Mac** app (not iPhone/iPad). The product is the same playground as [shell.py4e.com](https://shell.py4e.com/).

Apple will not accept the current unsigned `.dmg`. You still need an Apple Developer Program account, a Mac App Store (`mas`) build with sandboxing, and a privacy-policy URL that is live on the web.

## Name (≤30)

PythonShell

## Subtitle (≤30)

A Python playground

## Promotional text (≤170, optional)

A free Python playground from Python for Everybody. Edit files, press Run, and use a small Linux-like shell. No account. Python runs on your Mac.

## Description (≤4000)

PythonShell is a simple Python playground from Python for Everybody. Open it and start coding. There is no login, no course launch, and no grading.

Write Python in a multi-file editor, press Run, and see the result in a small Linux-like shell. The same shell understands commands such as python main.py, ls, rm, help, upload, and download. When a program calls input(), type the answer at the shell prompt.

Python 3.12 runs on your Mac inside the app (Pyodide). Your code is not sent to a server to be executed. Work is saved only on this Mac. Clearing the app’s data or resetting the workspace will lose it — that is intentional. This is a place to experiment, not an assignment drop-box.

The first launch needs an internet connection so the Python runtime can download. Later launches reuse the cached runtime.

The web version is at https://shell.py4e.com/

WHAT YOU CAN DO

• Edit several files in tabs (create, rename, delete, upload, download)
• Run the current file, or type python file.py in the shell
• See print output, errors, and tracebacks
• Answer input() prompts in the shell
• Stop a runaway program (the runtime times out and restarts)
• Reset the workspace to the starter files (main.py, about.txt, romeo.txt, mbox-short.txt)

WHAT IT IS NOT

• Not a full Linux terminal (no pipes, redirects, or globs)
• Not an interactive Python REPL (>>>); run a file instead
• Not a grader and not connected to a learning-management system
• Not a place to install extra native Python packages beyond the bundled standard library

PythonShell is provided free of charge by Python for Everybody (https://www.py4e.com/).

## Keywords (≤100, comma-separated, do not include “PythonShell”)

python,learn python,coding,education,beginner,editor,shell,py4e,playground

## What’s New

First Mac App Store release of PythonShell: a free Python playground from Python for Everybody. Edit files, press Run, and use a small Linux-like shell. Python runs on your Mac; no account required.

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
- The app contacts the internet **once on first launch** to download the pinned Python runtime (Pyodide) from a public CDN (jsDelivr). That download is not used to identify the user. After that, Python runs locally.
- Workspace files stay on the device (the app’s own storage). They are not uploaded to Python for Everybody servers.
- Upload/download of learner files happens only when the user chooses a file.

If Apple’s form asks whether the app uses data from the device that never leaves the device, that is the workspace in local storage only.

## Privacy Policy URL

https://shell.py4e.com/privacy.html

## Privacy policy (source)

The live page is [`privacy.html`](../../../privacy.html) at the site root.

## Notes for App Review (App Store Connect → App Review Information)

Paste this:

PythonShell is a free education app from Python for Everybody (www.py4e.com). There is no login and no in-app purchase.

To test: (1) Allow the first launch to use the network — the app downloads a pinned Python runtime, Pyodide 0.27.5 (Python 3.12 as WebAssembly) from the public jsDelivr CDN, then caches it. Learner programs are not sent to a server. Users cannot install extra packages. (2) Press Run on main.py (or type python main.py). When asked for a name, type one and press Enter. The shell should print Hello plus that name. (3) Help → About PythonShell credits Python for Everybody.

Demo account: none. Contact if a build will not start without network on a clean Mac.

## Screenshot caption

Edit main.py, press Run, and answer input() in the Linux-like shell.

Mac App Store wants 1280×800 or 1440×900 (or 2560×1600 / 2880×1800) Mac screenshots. The current Windows capture in desktop/store/microsoft/ will not meet that size/platform requirement.

## Copyright

Copyright © Python for Everybody

## Bundle / identity (already in the desktop app)

- Bundle ID: com.py4e.pythonshell
- SKU (you choose, once): pythonshell-mac
- Price: Free

## Packaging (not listing text, but you will hit this)

The GitHub `.dmg` is **not** a Mac App Store build. Store submission needs:

- Apple Developer Program membership
- electron-builder **mas** target, sandboxed, signed with a Mac App Distribution certificate
- Hardened runtime / entitlements for network (Pyodide download) and the file picker (upload/download)
- App Review may question downloading Pyodide at runtime (Guideline 2.5.2). The review notes above explain it is a pinned interpreter, not a plugin store. If they still reject it, the runtime must be bundled inside the app instead of fetched from jsDelivr.
