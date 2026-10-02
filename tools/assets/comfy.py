"""Thin ComfyUI API helpers shared by the asset scripts (submit graph, poll, download, upload)."""
import json
import os
import time
import uuid

import requests

from comfyui_client import ensure_comfyui  # resolves URL from WSL, starts app if needed

_BASE = None


def base_url(log=print):
    global _BASE
    if _BASE is None:
        _BASE = ensure_comfyui(log=log)
        log(f"ComfyUI at {_BASE}")
    return _BASE


def upload_image(path, subfolder="pv", log=print):
    """Upload an image into ComfyUI's input folder; returns the name LoadImage expects."""
    with open(path, "rb") as f:
        r = requests.post(
            f"{base_url(log)}/upload/image",
            files={"image": (os.path.basename(path), f, "image/png")},
            data={"subfolder": subfolder, "overwrite": "true"},
            timeout=60,
        )
    r.raise_for_status()
    j = r.json()
    name = j.get("name") or os.path.basename(path)
    sub = j.get("subfolder") or subfolder
    return f"{sub}/{name}" if sub else name


def submit_and_wait(graph, timeout=1800, log=print, poll=2.0):
    """Queue an API-format graph, wait for completion, return the history entry's outputs dict."""
    url = base_url(log)
    client_id = str(uuid.uuid4())
    r = requests.post(f"{url}/prompt", json={"prompt": graph, "client_id": client_id}, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"ComfyUI rejected the graph ({r.status_code}): {r.text[:2000]}")
    prompt_id = r.json()["prompt_id"]
    t0 = time.time()
    last_log = 0
    while time.time() - t0 < timeout:
        hist = requests.get(f"{url}/history/{prompt_id}", timeout=30).json()
        entry = hist.get(prompt_id)
        if entry:
            status = entry.get("status", {})
            if status.get("status_str") == "error" or status.get("completed") is False and status.get("messages"):
                msgs = status.get("messages", [])
                errs = [m for m in msgs if m and m[0] == "execution_error"]
                if errs:
                    raise RuntimeError(f"ComfyUI execution error: {json.dumps(errs[0][1])[:2000]}")
            if entry.get("outputs"):
                return entry["outputs"]
        if time.time() - last_log > 20:
            last_log = time.time()
            log(f"  … waiting ({int(time.time() - t0)}s)")
        time.sleep(poll)
    raise TimeoutError(f"ComfyUI job {prompt_id} did not finish within {timeout}s")


def download(ref, dest, log=print):
    """ref = {'filename','subfolder','type'} from history outputs."""
    r = requests.get(
        f"{base_url(log)}/view",
        params={"filename": ref["filename"], "subfolder": ref.get("subfolder", ""), "type": ref.get("type", "output")},
        timeout=300,
    )
    r.raise_for_status()
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    with open(dest, "wb") as f:
        f.write(r.content)
    return dest


def first_output(outputs, key):
    """Find the first output list under `key` ('images', 'audio', '3d', ...) across all nodes."""
    for node_out in outputs.values():
        if key in node_out and node_out[key]:
            return node_out[key][0]
    # SaveGLB stores under 'result' or '3d' depending on version – search generically
    for node_out in outputs.values():
        for k, v in node_out.items():
            if isinstance(v, list) and v and isinstance(v[0], dict) and "filename" in v[0]:
                if key == "3d" and v[0]["filename"].lower().endswith((".glb", ".gltf", ".obj")):
                    return v[0]
    raise RuntimeError(f"No '{key}' output in ComfyUI result: {json.dumps(outputs)[:800]}")
