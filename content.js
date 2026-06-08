// Tildes Polka Typewriter
// Plays a looping polka loop while you type into a post/comment field on
// tildes.net, and pauses ~250ms after you stop. Pure browser APIs, no deps.

(function () {
  "use strict";

  const PAUSE_DELAY_MS = 500;

  // Single shared audio element, created lazily on first real keystroke so the
  // browser's autoplay policy sees a genuine user gesture before .play().
  let audio = null;
  let pauseTimer = null;

  function getAudio() {
    if (audio) return audio;
    audio = new Audio(chrome.runtime.getURL("audio/polka.mp3"));
    audio.loop = true;
    audio.preload = "auto";
    return audio;
  }

  // True for the fields a person actually composes a post or comment in:
  // any <textarea>, plus contenteditable regions (some markdown editors swap
  // the textarea for one). Plain <input> is excluded — those are search boxes,
  // titles, etc., not the prose you'd want a soundtrack for.
  function isComposeField(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // Issue #1 asked to unmute and raise the *system* volume when it's muted or
  // below 30%. A content script can't touch the OS mixer, and can't even call
  // chrome.runtime.connectNative (that's background-only). So when playback
  // begins we hand the request to the service worker, which relays it to a
  // native messaging host that runs `wpctl`. It's opt-in: the worker no-ops
  // unless the user ticked the checkbox in the popup, so we always send and let
  // the worker decide. We only ask once per playback (re)start to avoid firing
  // on every keystroke.
  function requestOsVolume() {
    try {
      chrome.runtime.sendMessage({ type: "ensureOsVolume" }, () => {
        // Swallow lastError: worker disabled, host missing, etc. are all fine.
        void chrome.runtime.lastError;
      });
    } catch (_) {
      // Extension context invalidated (e.g. reload). Nothing to do.
    }
  }

  function startOrResume() {
    const a = getAudio();
    if (a.paused) {
      // play() returns a promise that rejects if autoplay is blocked; ignore
      // the rejection so a blocked first attempt doesn't throw. The next
      // keystroke (still within a gesture) will try again.
      a.play()
        .then(requestOsVolume)
        .catch(() => {});
    }
  }

  function schedulePause() {
    if (pauseTimer !== null) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      if (audio && !audio.paused) audio.pause();
    }, PAUSE_DELAY_MS);
  }

  // Each keystroke inside a compose field: (re)start the music and push the
  // pause deadline out. Keeping typing => the timer never fires => continuous
  // playback. Stop => the last-scheduled pause lands PAUSE_DELAY_MS later.
  function onKeydown(e) {
    if (!isComposeField(e.target)) return;
    // Ignore pure modifier/navigation presses that don't represent "typing".
    if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" ||
        e.key === "Meta") {
      return;
    }
    startOrResume();
    schedulePause();
  }

  // Listen on the document (capture) so dynamically-added editors are covered
  // without re-binding. One listener, no per-field wiring.
  document.addEventListener("keydown", onKeydown, true);

  // --- Relabel the submit buttons --------------------------------------------
  // The "Post comment" and "Post topic" buttons become "Carthago delenda est".
  // Tildes renders these as <button> elements (markdown forms also carry an
  // <input type="submit">), so cover both. Matching is on exact trimmed label
  // text — narrow enough to leave Reply/Preview/Edit/Cancel untouched.
  const NEW_LABEL = "Carthago delenda est";
  const TARGET_LABELS = new Set(["Post comment", "Post topic"]);

  function labelOf(el) {
    if (el.tagName === "INPUT") return (el.value || "").trim();
    return (el.textContent || "").trim();
  }

  function relabel(el) {
    if (el.dataset.carthago === "1") return; // already done
    if (!TARGET_LABELS.has(labelOf(el))) return;
    if (el.tagName === "INPUT") {
      el.value = NEW_LABEL;
    } else {
      el.textContent = NEW_LABEL;
    }
    el.dataset.carthago = "1";
  }

  function relabelWithin(root) {
    if (root.nodeType !== 1) return; // elements only
    const buttons = root.querySelectorAll(
      'button[type="submit"], input[type="submit"], button'
    );
    buttons.forEach(relabel);
    // root itself might be a matching button (querySelectorAll excludes it).
    if (root.matches && root.matches('button, input[type="submit"]')) {
      relabel(root);
    }
  }

  relabelWithin(document.body);

  // Reply/edit forms are injected via AJAX, so watch for new nodes. textContent
  // edits we make ourselves are gated by the data-carthago flag, so the
  // observer won't loop on its own mutations.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(relabelWithin);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
