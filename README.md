# Tildes Polka Typewriter

A minimal Chrome (Manifest V3) extension that plays looping polka music while
you type a post or comment on [tildes.net](https://tildes.net), and pauses
shortly after you stop typing. Type to keep the music going.

## Behavior

- Active **only** on `tildes.net` (enforced by the manifest `matches`).
- Music starts on the first keystroke inside a compose field (`<textarea>` or
  a contenteditable editor).
- Each keystroke resumes playback and resets a pause timer.
- Shortly after your last keystroke, the audio pauses. Keep typing and it
  never pauses; stop and it cuts out quickly.
- **Optional:** raise the system volume when the polka plays. If your system is
  muted or below 30%, unmute and set it to 50%. Off by default — see
  [System volume (native host)](#system-volume-native-host).

## Dependencies

The extension itself needs nothing beyond the browser: the content script is
plain JavaScript using the native `Audio` element and `addEventListener` — no
libraries, no build step. The only bundled asset is the audio file (required so
it works offline).

The optional system-volume feature is separate. A content script can't touch the
OS mixer (it's sandboxed), so that feature relays through a small **native
messaging host** that runs `wpctl`. It requires Linux + PipeWire and a one-time
install step. If you skip it, the rest of the extension works exactly as before.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this directory.
4. Visit tildes.net, open a reply/compose box, and start typing.

> First playback needs a user gesture (the autoplay policy). Typing counts as
> one, so the first keystroke both satisfies the gesture and starts the music.

The extension's ID is pinned (via the `key` field in `manifest.json`) to
`pobfpngnkpgomhfpoaboejanbikilhhe`, so it stays the same across reloads. The
native host's allow-list depends on this; don't remove the `key`.

## System volume (native host)

This feature is **Linux + PipeWire only** and **off by default**.

1. Load the extension (above).
2. Install the native messaging host:

   ```
   ./native-host/install.sh
   ```

   This writes a host manifest into your browser's `NativeMessagingHosts`
   directory (Chrome/Chromium/Edge, whichever are present) pointing at a
   generated `native-host/volume_host.sh` launcher. The extension ID is baked
   into the installer, so no copy-paste from `chrome://extensions` is needed.
3. Open the extension popup (toolbar icon), tick **"Raise system volume when the
   polka plays"**, and click **Test native host** to confirm it's reachable.

How it works: when playback starts, the content script asks the background
service worker to ensure audible volume; the worker calls the native host only
when the checkbox is enabled; the host reads the **default sink** and, if it's
muted or below 30%, unmutes it and sets it to 50%.

> The host targets PipeWire's *default* sink (`@DEFAULT_AUDIO_SINK@`). If "Test"
> reports no change while you can hear the volume is low, your default sink is
> probably a different device than the one you're hearing. Check with
> `wpctl status` (the default has a `*`) and set it with
> `wpctl set-default <id>`. The host falls back to `pactl` if `wpctl` is absent.

## Audio license

`audio/polka.mp3` is **"Gipfelstürmer Akkordeon-Polka"** by **Bernhard Schürmann**, licensed under
[the Pixabay Content Licens](https://pixabay.com/service/license-summary/).

