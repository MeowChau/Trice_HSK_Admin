/** One list owns one coordinator. A new request cancels its predecessor and
 * guards state updates even if the old response was already being decoded. */
export class LatestRequest {
  private controller: AbortController | null = null;
  start() {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () =>
        this.controller === controller && !controller.signal.aborted,
    };
  }
  cancel() {
    this.controller?.abort();
    this.controller = null;
  }
}
