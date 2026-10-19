/**
 * Browser half of dsh-next-hint — walking skeleton.
 *
 * The host serves this file as the package's "./client" bundle; the module
 * loader registers the factory at boot and runs it only when the plugin first
 * materializes.
 */
window.__ModuleLoader__.load({
  id: "dsh-next-hint",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    /** Client services to inject. Empty until spike C1 names them. */
    exports.inject = [];

    exports.apply = function apply(_ctx, _config) {
      // Phase 2 (lane: client) mounts here:
      //   feed subscription -> suggestion strip -> insertText on accept,
      //   and every listener/DOM node returned through ctx.effect.
    };

    return module.exports;
  },
});
