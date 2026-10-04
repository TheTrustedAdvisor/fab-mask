/*
 * Runs in the page's MAIN world at document_start. Shadow roots attached after an element was
 * inserted (lazy custom-element upgrades) cause no DOM mutation the content script could observe,
 * so the page's attachShadow() is wrapped to announce new roots with a DOM event. The event carries
 * no data; the isolated-world content script only uses it as a hint to look at the host element.
 */
(function () {
  'use strict';
  const proto = Element.prototype;
  const original = proto.attachShadow;
  if (typeof original !== 'function' || original.__fabMaskWrapped) return;
  const wrapped = function attachShadow(init) {
    const root = original.call(this, init);
    const host = this;
    queueMicrotask(() => {
      host.dispatchEvent(new Event('fab-mask-shadow-attached', { bubbles: true, composed: true }));
    });
    return root;
  };
  Object.defineProperty(wrapped, '__fabMaskWrapped', { value: true });
  Object.defineProperty(proto, 'attachShadow', { value: wrapped, writable: true, configurable: true });
})();
