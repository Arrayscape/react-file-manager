"""Just enough of the Chrome DevTools protocol to drive a headless browser.

Shared by capture-render and fetch-repeaters: launch Chrome with a throwaway
profile, navigate, run JavaScript in the page, take a screenshot. Written
against the protocol directly because the two things that matter here --
real layout geometry and Wix's runtime-generated CSS -- only exist in a
browser that has actually rendered the page, and a full automation framework
would be a 150MB download for three methods.
"""

import atexit
import os
import sys
import json
import base64
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

from websockets.sync.client import connect

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

DESKTOP = {"width": 1280, "height": 800, "mobile": False, "ua": None}
MOBILE = {"width": 390, "height": 844, "mobile": True,
          "ua": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
                 "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 "
                 "Mobile/15E148 Safari/604.1")}


PREFIX = "arrayscape-capture-"


def _our_chromes():
    """Chrome processes running on one of our throwaway profiles.

    -> [(pid, ppid, profile directory name)]

    Every process in the group carries the profile in --user-data-dir, so the
    directory name identifies ours unambiguously. Matching on that AND on the
    binary being Chrome matters in both directions: the prefix keeps us off
    other projects' browsers and the user's own, and requiring Chrome keeps a
    shell or editor that merely mentions the path from being mistaken for one.
    """
    try:
        out = subprocess.run(["ps", "-eo", "pid=,ppid=,command="],
                             capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return None                 # cannot tell what is running: do nothing
    found = []
    for line in out.splitlines():
        if "Google Chrome" not in line or PREFIX not in line:
            continue
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        at = parts[2].find(PREFIX)
        name = parts[2][at:].split("/")[0].split()[0].rstrip('"').rstrip("'")
        try:
            found.append((int(parts[0]), int(parts[1]), name))
        except ValueError:
            continue
    return found


def _sweep_orphans(max_age=300):
    """Clear the Chrome processes and profiles a killed run left behind.

    atexit covers a clean exit and an exception; nothing covers SIGKILL, so a
    killed capture leaves both its profile and its whole Chrome process group
    running. Those processes never exit on their own -- they are reparented to
    launchd and sit there holding the profile open, which is how 47 directories
    and roughly 309 processes accumulated over nine days, 18 GB of disk and
    close to a gigabyte of resident memory. Each run therefore clears what
    earlier ones abandoned.

    AN ORPHAN IS IDENTIFIED BY ITS PARENT, NOT BY ITS AGE. When the Python
    process that launched Chrome dies, the launcher is reparented to init, so
    ppid == 1 means "whoever started this is gone". A concurrent run's launcher
    still has its Python parent and is never touched -- which age alone cannot
    guarantee, because a long capture's profile directory can easily go five
    minutes without being written to.

    Only the process GROUP of such a launcher is signalled. Chrome's renderer,
    gpu and utility helpers are what hold the profile open, so signalling the
    launcher alone would leave the directory undeletable.

    Nothing outside our own profiles is ever signalled or removed: the prefix
    is ours, and the current process's group is excluded outright.
    """
    root = Path(tempfile.gettempdir())
    procs = _our_chromes()
    if procs is None:
        return

    # Orphans: our Chrome, whose launcher lost its parent. Helpers are reached
    # through the group rather than listed individually.
    try:
        mine = os.getpgrp()
    except OSError:
        mine = None
    orphan_dirs, killed = set(), 0
    for pid, ppid, name in procs:
        if ppid != 1:
            continue
        try:
            pgid = os.getpgid(pid)
        except OSError:
            continue
        if mine is not None and pgid == mine:
            continue            # never signal the group we are running in
        orphan_dirs.add(name)
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(pgid, sig)
            except (ProcessLookupError, PermissionError):
                break
            time.sleep(0.5)
            try:
                os.kill(pid, 0)
            except OSError:
                break           # gone
        killed += 1

    # Re-read: the helpers of a group just killed should no longer be holding
    # anything, and a directory is only removed once nothing names it.
    still = _our_chromes()
    held = {name for _, _, name in (still or [])}
    gone = 0
    for d in root.glob(PREFIX + "*"):
        if not d.is_dir() or d.name in held:
            continue
        if d.name not in orphan_dirs and time.time() - d.stat().st_mtime <= max_age:
            # Not a known orphan and recent: could be a run that has just made
            # its directory and not yet started Chrome. Leave it alone.
            continue
        shutil.rmtree(d, ignore_errors=True)
        gone += not d.exists()

    if killed or gone:
        print(f"cdp: cleared {killed} abandoned Chrome process group(s) and "
              f"{gone} profile(s) from a killed run", file=sys.stderr)


class Chrome:
    """Just enough DevTools protocol: navigate, evaluate, screenshot."""

    def __init__(self, viewport):
        _sweep_orphans()
        self.profile = tempfile.mkdtemp(prefix="arrayscape-capture-")
        self.proc = None
        self._conn = None
        port = free_port()
        self.proc = subprocess.Popen(
            [CHROME, "--headless=new", f"--remote-debugging-port={port}",
             f"--user-data-dir={self.profile}", "--no-first-run", "--no-default-browser-check",
             "--disable-background-networking", "--disable-extensions", "--mute-audio",
             "--hide-scrollbars", "--force-device-scale-factor=1",
             # A throwaway profile does not need a disk cache, and left at the
             # default one run over 70 image-heavy pages leaves 1.5 GB behind.
             # Forty-seven abandoned profiles were 18 GB.
             "--disk-cache-size=1",
             f"--window-size={viewport['width']},{viewport['height']}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            # Its own process group, so close() can signal the helpers too.
            # Chrome forks a renderer, a gpu process and several utilities;
            # signalling the launcher alone leaves them running, and they hold
            # the profile open so removing it fails.
            start_new_session=True)

        # Nothing below here may leak the process or the directory. Until this
        # returns there is no object for a caller to close, so a failure has to
        # clean up after itself -- this is the path that leaked most often,
        # because a Chrome that starts but never answers is exactly when the
        # exception fires.
        atexit.register(self.close)
        try:
            ws_url = None
            for _ in range(100):
                try:
                    info = json.loads(urlopen(f"http://127.0.0.1:{port}/json/version").read())
                    ws_url = info["webSocketDebuggerUrl"]
                    break
                except Exception:
                    time.sleep(0.2)
            if not ws_url:
                raise RuntimeError("headless Chrome did not come up")
            # Entered rather than used bare: websockets warns about a
            # connection held outside its context manager, and this one lives
            # for the run.
            self._conn = connect(ws_url, max_size=200 * 1024 * 1024, open_timeout=30)
            self.ws = self._conn.__enter__()
            self.n = 0
        except BaseException:
            self.close()
            raise
        self.session = None
        targets = self.send("Target.getTargets")["targetInfos"]
        page = next(t for t in targets if t["type"] == "page")
        self.session = self.send("Target.attachToTarget",
                                 {"targetId": page["targetId"], "flatten": True})["sessionId"]
        self.send("Page.enable")
        self.send("Runtime.enable")
        self.send("Emulation.setDeviceMetricsOverride", {
            "width": viewport["width"], "height": viewport["height"],
            "deviceScaleFactor": 1, "mobile": viewport["mobile"]})
        if viewport["ua"]:
            self.send("Emulation.setUserAgentOverride", {"userAgent": viewport["ua"]})

    def send(self, method, params=None, timeout=120):
        self.n += 1
        msg = {"id": self.n, "method": method, "params": params or {}}
        if self.session:
            msg["sessionId"] = self.session
        self.ws.send(json.dumps(msg))
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = json.loads(self.ws.recv(timeout=max(1, deadline - time.time())))
            if raw.get("id") == self.n:
                if "error" in raw:
                    raise RuntimeError(f"{method}: {raw['error']}")
                return raw.get("result", {})
        raise TimeoutError(method)

    def goto(self, url, settle=1.0):
        self.send("Page.navigate", {"url": url})
        # Page.loadEventFired needs event plumbing; polling readyState is
        # simpler and just as good for a static mirror.
        for _ in range(150):
            time.sleep(0.2)
            state = self.evaluate("document.readyState")
            if state == "complete":
                break
        time.sleep(settle)

    def evaluate(self, expr, await_promise=False):
        res = self.send("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "awaitPromise": await_promise})
        if "exceptionDetails" in res:
            raise RuntimeError(res["exceptionDetails"].get("text", "evaluate failed"))
        return res["result"].get("value")

    def screenshot(self, path):
        data = self.send("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
        path.write_bytes(base64.b64decode(data["data"]))

    def close(self):
        """Idempotent: also runs from atexit, and from __init__ on failure."""
        if getattr(self, "_closed", False):
            return
        self._closed = True
        try:
            if self._conn is not None:
                self._conn.__exit__(None, None, None)
        except Exception:
            pass

        # The whole group, not just the launcher. Chrome's helpers are what
        # hold the profile open, so signalling the parent alone leaves both the
        # processes and the directory behind -- 42 of them, over nine days.
        if self.proc is not None:
            for sig in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(os.getpgid(self.proc.pid), sig)
                except (ProcessLookupError, PermissionError):
                    break
                try:
                    self.proc.wait(timeout=10)
                    break
                except subprocess.TimeoutExpired:
                    continue

        # Not ignore_errors: a profile that cannot be removed means something
        # is still holding it, and that is the failure worth hearing about
        # rather than the one to swallow.
        try:
            shutil.rmtree(self.profile)
        except FileNotFoundError:
            pass
        except OSError as e:
            print(f"cdp: could not remove {self.profile}: {e}", file=sys.stderr)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]
