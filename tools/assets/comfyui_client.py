"""Resolve a reachable base URL for the Pinokio-managed ComfyUI instance.

ComfyUI (Pinokio app id "inteliweb-comfyui.git") listens on 0.0.0.0:8188 on the
Windows host. From WSL, 0.0.0.0/127.0.0.1 are not routable to it, so we ask the
Pinokio control plane (via pterm) which real host to use, and cache nothing
across runs since Pinokio's advertised access host can change between reboots.
"""

import json
import os
import subprocess
import time
import urllib.request
import urllib.error

APP_ID = "inteliweb-comfyui.git"
PINOKIO_HOME = "/mnt/c/Users/Home"
PTERM_CANDIDATES = [
    "/mnt/c/pinokio/bin/npm/pterm",
    os.path.expanduser("~/.pinokio/bin/npm/pterm"),
]


def _pterm_path():
    for p in PTERM_CANDIDATES:
        if os.path.isfile(p):
            return p
    raise RuntimeError(
        "Could not find the pterm binary (looked in: %s). Is Pinokio installed?"
        % ", ".join(PTERM_CANDIDATES)
    )


def _pterm(*args, timeout=30):
    env = dict(os.environ)
    env["HOME"] = PINOKIO_HOME
    proc = subprocess.run(
        [_pterm_path(), *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=timeout,
    )
    return proc


def _probe_http(url, path="/system_stats", timeout=2.0):
    try:
        with urllib.request.urlopen(url.rstrip("/") + path, timeout=timeout) as r:
            return r.status == 200
    except Exception:
        return False


def _status():
    proc = _pterm("status", APP_ID, "--probe", timeout=15)
    if proc.returncode != 0:
        raise RuntimeError(
            "pterm status failed (rc=%s): %s" % (proc.returncode, proc.stderr.strip())
        )
    return json.loads(proc.stdout)


def _resolve_from_status(status):
    ready_url = status.get("ready_url") or status.get("default_target")
    if not ready_url:
        return None
    port = ready_url.rsplit(":", 1)[-1]
    host = (status.get("source") or {}).get("host")
    candidates = []
    if host:
        candidates.append(f"http://{host}:{port}")
    candidates.append(f"http://127.0.0.1:{port}")
    candidates.append(ready_url)
    for c in candidates:
        if _probe_http(c):
            return c
    return None


def ensure_comfyui(start_timeout=180, log=print):
    """Return a reachable ComfyUI base URL, starting the app via pterm if needed."""
    env_url = os.environ.get("COMFYUI_URL")
    if env_url and _probe_http(env_url):
        return env_url

    status = _status()
    if status.get("running") and status.get("ready"):
        url = _resolve_from_status(status)
        if url:
            return url

    log("ComfyUI is not ready yet - starting it via Pinokio (pterm run) ...")
    ref = status.get("ref") or APP_ID
    proc = _pterm(
        "run", ref, "--default", "run.js?mode=Default", "--default", "run.js",
        timeout=start_timeout + 15,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            "pterm run failed (rc=%s): %s" % (proc.returncode, proc.stderr.strip())
        )

    deadline = time.time() + start_timeout
    while time.time() < deadline:
        status = _status()
        if status.get("running") and status.get("ready"):
            url = _resolve_from_status(status)
            if url:
                return url
        time.sleep(2)

    raise RuntimeError(
        "ComfyUI did not become ready within %ss. Check the Pinokio app logs "
        "for '%s'." % (start_timeout, APP_ID)
    )
