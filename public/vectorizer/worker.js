/* Runs the tracer off the main thread. The page posts { id, pixels, w, h, opts } and hears back 'stage' messages
   while it works, then 'done' with the result (or 'error'). */
importScripts("tracer.js");

self.onmessage = function (e) {
  var m = e.data;
  try {
    var res = self.VTrace.trace(m.pixels, m.w, m.h, m.opts, function (stage) { self.postMessage({ type: "stage", id: m.id, stage: stage }); });
    self.postMessage({ type: "done", id: m.id, res: res });
  } catch (err) {
    self.postMessage({ type: "error", id: m.id, message: String((err && err.message) || err) });
  }
};
