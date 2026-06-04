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

## Dependencies

None beyond the browser. The content script is plain JavaScript using the
native `Audio` element and `addEventListener` — no libraries, no build step.
The only bundled asset is the audio file (required so it works offline).

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this directory.
4. Visit tildes.net, open a reply/compose box, and start typing.

> First playback needs a user gesture (the autoplay policy). Typing counts as
> one, so the first keystroke both satisfies the gesture and starts the music.

## Audio license

`audio/polka.mp3` is **"Gipfelstürmer Akkordeon-Polka"** by **Bernhard Schürmann**, licensed under
[the Pixabay Content Licens](https://pixabay.com/service/license-summary/).

