#!/usr/bin/env python3
"""Native messaging host for Tildes Polka Typewriter.

Chrome launches this process and talks to it over stdin/stdout using the native
messaging protocol: each message is a 4-byte little-endian length prefix
followed by that many bytes of UTF-8 JSON. We read one request, act on it, write
one JSON reply, and exit.

Supported request:
    {"cmd": "ensure", "floor": 30, "target": 50}

Meaning: read the default audio sink's volume; if it's muted OR below `floor`
percent, unmute it and set it to `target` percent. Reply:
    {"changed": bool, "before": int, "after": int, "backend": "wpctl"|"pactl"}
or on failure:
    {"error": "..."}

Linux only. Prefers PipeWire's `wpctl`; falls back to PulseAudio's `pactl`.
"""

import json
import re
import shutil
import struct
import subprocess
import sys


def read_message():
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        return None  # stdin closed; nothing to do
    (length,) = struct.unpack("<I", raw_len)
    data = sys.stdin.buffer.read(length)
    return json.loads(data.decode("utf-8"))


def write_message(obj):
    data = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def run(cmd):
    return subprocess.run(
        cmd, capture_output=True, text=True, check=True
    ).stdout.strip()


# --- wpctl (PipeWire) -------------------------------------------------------
# `wpctl get-volume @DEFAULT_AUDIO_SINK@` -> "Volume: 0.35" or
# "Volume: 0.35 [MUTED]". wpctl takes/returns a 0.0-1.0 float.
WPCTL_SINK = "@DEFAULT_AUDIO_SINK@"


def wpctl_state():
    out = run(["wpctl", "get-volume", WPCTL_SINK])
    m = re.search(r"Volume:\s*([0-9.]+)", out)
    if not m:
        raise RuntimeError("could not parse wpctl output: %r" % out)
    volume = float(m.group(1))
    muted = "MUTED" in out
    return volume, muted


def wpctl_set(target_fraction):
    run(["wpctl", "set-mute", WPCTL_SINK, "0"])
    run(["wpctl", "set-volume", WPCTL_SINK, "%.2f" % target_fraction])


# --- pactl (PulseAudio) -----------------------------------------------------
PACTL_SINK = "@DEFAULT_SINK@"


def pactl_state():
    vol_out = run(["pactl", "get-sink-volume", PACTL_SINK])
    m = re.search(r"(\d+)%", vol_out)
    if not m:
        raise RuntimeError("could not parse pactl volume: %r" % vol_out)
    volume = int(m.group(1)) / 100.0
    mute_out = run(["pactl", "get-sink-mute", PACTL_SINK])
    muted = "yes" in mute_out.lower()
    return volume, muted


def pactl_set(target_fraction):
    run(["pactl", "set-sink-mute", PACTL_SINK, "0"])
    run(["pactl", "set-sink-volume", PACTL_SINK, "%d%%" % round(target_fraction * 100)])


def pick_backend():
    if shutil.which("wpctl"):
        return "wpctl", wpctl_state, wpctl_set
    if shutil.which("pactl"):
        return "pactl", pactl_state, pactl_set
    raise RuntimeError("neither wpctl nor pactl found on PATH")


def handle_ensure(req):
    floor = float(req.get("floor", 30)) / 100.0
    target = float(req.get("target", 50)) / 100.0

    name, get_state, set_vol = pick_backend()
    volume, muted = get_state()
    before = round(volume * 100)

    if muted or volume < floor:
        set_vol(target)
        return {
            "changed": True,
            "before": before,
            "after": round(target * 100),
            "muted_before": muted,
            "backend": name,
        }
    return {"changed": False, "before": before, "after": before, "backend": name}


def main():
    try:
        req = read_message()
    except Exception as e:  # malformed framing/JSON
        write_message({"error": "bad request: %s" % e})
        return
    if req is None:
        return

    try:
        cmd = req.get("cmd")
        if cmd == "ensure":
            write_message(handle_ensure(req))
        else:
            write_message({"error": "unknown cmd: %r" % cmd})
    except subprocess.CalledProcessError as e:
        write_message({"error": "command failed: %s" % (e.stderr or e).strip()})
    except Exception as e:
        write_message({"error": str(e)})


if __name__ == "__main__":
    main()
