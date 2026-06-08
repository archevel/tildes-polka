// Popup: toggle the opt-in OS-volume feature and let the user verify the native
// host is reachable. The checkbox state lives in chrome.storage.local under the
// same key the background worker reads ("osVolumeEnabled").

const STORAGE_KEY = "osVolumeEnabled";
const checkbox = document.getElementById("osVolume");
const testBtn = document.getElementById("test");
const status = document.getElementById("status");

function setStatus(text, kind) {
  status.textContent = text;
  status.className = kind || "";
}

// Load saved state.
chrome.storage.local.get(STORAGE_KEY, (res) => {
  checkbox.checked = res[STORAGE_KEY] === true;
});

checkbox.addEventListener("change", () => {
  chrome.storage.local.set({ [STORAGE_KEY]: checkbox.checked }, () => {
    setStatus(checkbox.checked ? "Enabled." : "Disabled.", "ok");
  });
});

// "Test" exercises the full path: popup -> background -> native host -> wpctl.
// We send the ensure message directly; the worker honors it only when enabled,
// so we briefly note that case rather than silently doing nothing.
testBtn.addEventListener("click", () => {
  if (!checkbox.checked) {
    setStatus("Enable the checkbox first to test.", "err");
    return;
  }
  setStatus("Contacting native host…");
  chrome.runtime.sendMessage({ type: "ensureOsVolume" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus("Error: " + chrome.runtime.lastError.message, "err");
      return;
    }
    if (!resp) {
      setStatus("No response from background worker.", "err");
      return;
    }
    if (resp.ok) {
      const r = resp.reply;
      if (r && typeof r === "object") {
        setStatus(
          "OK. " +
            (r.changed
              ? `Volume ${r.before}% → ${r.after}%.`
              : `No change (was ${r.before}%).`),
          "ok"
        );
      } else {
        setStatus("OK (" + (resp.skipped || "done") + ").", "ok");
      }
    } else {
      setStatus("Host error: " + resp.error, "err");
    }
  });
});
