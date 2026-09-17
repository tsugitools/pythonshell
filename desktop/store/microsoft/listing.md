# Microsoft Store listing — PythonShell

Copy these fields into Partner Center. The desktop app is the same playground as [shell.py4e.com](https://shell.py4e.com/).

## Name

PythonShell

## Short description (≤256 characters)

A Python playground for learners: edit files, run them, and use a small Linux-like shell. Python runs on your computer. No account. Work stays on this device.

## Description

PythonShell is a simple Python playground from Python for Everybody. Open it and start coding. There is no login, no course launch, and no grading.

Write Python in a multi-file editor, press Run, and see the result in a small Linux-like shell. The same shell understands commands such as `python main.py`, `ls`, `rm`, `help`, `upload`, and `download`. When a program calls `input()`, type the answer at the shell prompt.

Python 3.12 runs locally in the app (Pyodide). The runtime is included in the app. Your code is not sent to a server to be executed. Work is saved only on this device (localStorage in the app). Clearing app data, resetting the workspace, or using another PC will lose it — that is intentional. This is a place to experiment, not an assignment drop-box.

The web version is at https://shell.py4e.com/

What you can do

• Edit several files in tabs (create, rename, delete, upload, download)
• Run the current file, or type `python file.py` in the shell
• See print output, errors, and tracebacks
• Answer `input()` prompts in the shell
• Stop a runaway program (the runtime times out and restarts)
• Reset the workspace to the starter files (`hello.py`, `main.py`, `about.txt`, `romeo.txt`, `mbox-short.txt`)

What it is not

• Not a full Linux terminal (no pipes, redirects, or globs)
• Not an interactive Python REPL (`>>>`); run a file instead
• Not a grader and not connected to a learning-management system
• Not a place to install extra native Python packages beyond the bundled standard library

PythonShell is part of Python for Everybody (https://www.py4e.com/).

## Features (optional Partner Center bullets)

- Multi-file editor with Run, restart, and reset
- Linux-like shell: python, ls, rm, help, upload, download
- Real Python 3.12 in the app (Pyodide) — code is not executed on a server
- input() answers typed in the shell
- Work saved only on this device; no account required
- Starter texts for early Python for Everybody exercises

## What’s new in this version

Store identity and Windows packaging updates so PythonShell can be listed in the Microsoft Store. Same playground as before: editor, shell, and in-app Python.

## Search terms

python, python playground, learn python, py4e, python for everybody, coding, editor, shell, beginner python, pyodide

(Partner Center limits how many characters you can use here. Prefer: python, learn python, py4e, playground, beginner)

## Website / support

- Website: https://www.py4e.com/
- App / web playground: https://shell.py4e.com/
- Source and issues: https://github.com/tsugitools/pythonshell
- Support email: use the Partner Center contact you already have for Dr. Chuck

## Screenshot caption

`screenshot_01.png` — Edit `hello.py`, press Run, and see `hello py4e` in the Linux-like shell.

## Notes for certification testers

1. The Python runtime is bundled in the app. Internet is not required to press Run. Help may open www.py4e.com in a browser.
2. The window should show an editor, a file list (`main.py`, `about.txt`, …), and a shell with a `$` prompt.
3. `hello.py` is focused. Press **Run** (or type `python hello.py`). The shell should print `hello py4e`. Open `main.py`, press **Run**, and when asked `What is your name?`, type a name and press Enter. The shell should print `Hello` plus that name.
4. There is no sign-in. Work is stored only in the app (localStorage), not as files in Documents.
5. **Reset workspace** restores the starter files and discards edits.

## Restricted capability justification (`runFullTrust`)

Partner Center allows **500 characters**. Paste this:

PythonShell is a Win32 Electron (Chromium) desktop app packaged as MSIX, not a sandboxed UWP app. Store packaging for this model requires runFullTrust so Windows can install and run a full-trust desktop process. We use it only to host the editor, Linux-like shell, and in-app Python (Pyodide). We do not scan user libraries, install services, or need admin rights. Workspace stays in the app; files are uploaded or downloaded only when the user chooses.



## System notes (do not paste unless asked)

- Windows 10 version 1809 or later (MinVersion 10.0.17763.0)
- Python runtime is included in the app
- Category: Education
- Publisher display name: Dr. Chuck
