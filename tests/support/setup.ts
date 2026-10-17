/**
 * Vitest setup for the jsdom environment.
 *
 * jsdom does not implement the modal behaviour of <dialog>: emulate the open
 * state only, enough to test components that call showModal()/close().
 * Focus trapping and the inert background are covered by Playwright.
 */
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype;
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}
