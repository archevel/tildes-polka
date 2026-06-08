// Tildes Polka Typewriter — background service worker.
//
// The content script can't reach the OS, so it asks us (via runtime messaging)
// to ensure the system volume is audible. We relay that to a native messaging
// host (native-host/volume_host.py) which actually runs `wpctl`. The feature is
// opt-in: it stays off until the user ticks the checkbox in the popup, whose
// state we keep in chrome.storage under "osVolumeEnabled".

const HOST_NAME = "com.tildes.polka.volume";
const STORAGE_KEY = "osVolumeEnabled";

// The thresholds from issue #1: if muted or below FLOOR, bring it to TARGET.
const FLOOR_PERCENT = 30;
const TARGET_PERCENT = 50;

function isEnabled() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (res) => {
      resolve(res[STORAGE_KEY] === true);
    });
  });
}

// One-shot native message: connect, send, await a single reply, disconnect.
// sendNativeMessage would be simpler, but connectNative gives clearer errors
// and lets the host exit cleanly between calls.
function callHost(message) {
  return new Promise((resolve, reject) => {
    let port;
    try {
      port = chrome.runtime.connectNative(HOST_NAME);
    } catch (e) {
      reject(e);
      return;
    }
    let settled = false;
    port.onMessage.addListener((msg) => {
      settled = true;
      resolve(msg);
      port.disconnect();
    });
    port.onDisconnect.addListener(() => {
      if (settled) return;
      const err = chrome.runtime.lastError;
      reject(new Error(err ? err.message : "native host disconnected"));
    });
    port.postMessage(message);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "ensureOsVolume") return false;

  isEnabled().then((enabled) => {
    if (!enabled) {
      sendResponse({ ok: true, skipped: "disabled" });
      return;
    }
    callHost({ cmd: "ensure", floor: FLOOR_PERCENT, target: TARGET_PERCENT })
      .then((reply) => sendResponse({ ok: true, reply }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
  });

  // Keep the message channel open for the async sendResponse.
  return true;
});
