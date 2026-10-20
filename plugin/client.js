// Browser half of dsh-next-hint (AD-0004/0005): a zero-height slot component owns
// the inline ghost. Every failure path is "no ghost", never an error surface.
window.__ModuleLoader__.load({
  id: "dsh-next-hint",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");

    /** Must equal src/contracts/hint.mjs ROUTE_PATH; a bundle cannot import it. */
    const ROUTE_PATH = "/api/next-hint";
    const SETTLE_DELAY_MS = 350; // grace period so the host samples a complete transcript
    const NS = "next-hint";
    const SLOT_ID = "next-hint";

    const zh = { "ghost.accept": "Tab 采纳" };
    const en = { "ghost.accept": "Tab to accept" };
    exports.inject = ["slots", "sessions", "locale"];

    /** Did the session just finish a turn? */
    function settled(previous, next) {
      return previous === true && next === false;
    }

    /** Empty and editable draft, i.e. worth a suggestion. */
    function requestable(state) {
      const phase = state?.phase;
      return typeof state?.draft === "string" && state.draft.trim() === "" && (phase === "plain" || phase === "claimed");
    }

    /** A painted hint survives only while the draft is still the one it was made for. */
    function stillValid(state, hint) {
      return hint !== null && requestable(state);
    }

    /** Locate the composer that owns one slot occurrence. */
    function composerOf(anchor) {
      const root = anchor?.closest?.("[data-composer-dock]")?.parentElement ?? null;
      if (root === null) return null;
      // The scroll wrapper's first child is the positioned box the editor sits
      // in (class names are hashed, the data attribute is not).
      const grow = root.querySelector("[data-input-scroll]")?.firstElementChild ?? null;
      return { root, grow, placeholder: root.querySelector("[data-composer-placeholder]") };
    }

    /** A visible candidate menu owns Tab; the ghost must never steal it. */
    function menuOpen(root) {
      const overlay = root.querySelector("[data-composer-overlay]");
      if (overlay === null) return false;
      for (const child of overlay.children) if (child.getBoundingClientRect().height > 0) return true;
      return false;
    }

    /** Paint the ghost over the composer's first line. */
    function paintGhost(grow, text, t) {
      const editable = grow.querySelector("[contenteditable]") ?? grow;
      const style = getComputedStyle(editable);
      const node = document.createElement("span");
      const key = document.createElement("span");
      node.dataset.nextHint = "ghost";
      node.setAttribute("aria-hidden", "true");
      node.textContent = text;
      key.dataset.nextHint = "hint-key";
      key.textContent = t("ghost.accept");
      node.appendChild(key);
      Object.assign(node.style, {
        position: "absolute",
        left: style.paddingLeft,
        top: style.paddingTop,
        right: "14px",
        pointerEvents: "none",
        whiteSpace: "pre",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: "var(--dsw-alias-label-caption)",
        font: style.font,
        lineHeight: style.lineHeight,
        opacity: "0",
        transition: "opacity 120ms ease-out",
      });
      Object.assign(key.style, {
        marginLeft: "8px",
        padding: "0 6px",
        borderRadius: "6px",
        border: "1px solid var(--dsw-alias-border-l2)",
        fontSize: "11px",
        opacity: "0.8",
      });
      grow.appendChild(node);
      requestAnimationFrame(() => {
        node.style.opacity = "1";
      });
      return node;
    }

    /** One engine per mounted composer: request, paint, accept, clean up. */
    function createEngine(deps) {
      const { sessionId, input, anchor, t, list, readRunning } = deps;
      let hint = null;
      let node = null;
      let abort = null;
      let running = readRunning(sessionId);
      let epoch = 0; // one request per turn; a missed running edge must not strand it
      let requestedEpoch = -1;

      const snapshot = () => {
        try {
          return input.state.getSnapshot();
        } catch {
          return { draft: "", draftRev: -1, phase: "inert" };
        }
      };

      function mark(state, detail) {
        // Last decision on the anchor (DevTools) and in the console.
        const element = anchor();
        const label = detail === undefined ? state : state + ":" + detail;
        if (element !== null && element !== undefined && element.dataset !== undefined) element.dataset.nextHintState = label;
        console.debug("[next-hint] " + label);
      }

      function hide() {
        if (node !== null) node.remove();
        node = null;
        hint = null;
        const parts = composerOf(anchor());
        if (parts?.placeholder) parts.placeholder.style.visibility = "";
      }

      function show(text) {
        const parts = composerOf(anchor());
        if (parts === null || parts.grow === null) return;
        if (node !== null) node.remove();
        node = paintGhost(parts.grow, text, t);
        if (parts.placeholder) parts.placeholder.style.visibility = "hidden";
        hint = { text };
        mark("shown", String(text.length));
      }

      function accept() {
        if (hint === null) return false;
        const actions = input.actions ?? {};
        const span = actions.captureInsertion?.();
        if (span === undefined || span === null) return false;
        if (actions.insertText?.(hint.text, span) !== true) return false;
        hide();
        input.focus?.();
        return true;
      }

      async function request() {
        abort?.abort();
        const controller = new AbortController();
        abort = controller;
        mark("request", sessionId);
        try {
          // Let the host finish persisting the settled turn before it samples.
          await new Promise((resolve) => setTimeout(resolve, SETTLE_DELAY_MS));
          if (controller.signal.aborted) return;
          if (!requestable(snapshot())) return mark("skip", "draft-moved");
          const response = await fetch(ROUTE_PATH, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sessionId }),
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (response.status !== 200) {
            const reason = response.headers.get("x-next-hint-reason") ?? "";
            return mark("reply", response.status + (reason === "" ? "" : " " + reason));
          }
          const data = await response.json();
          if (typeof data?.hint !== "string" || data.hint === "") return mark("reply", "empty");
          if (!requestable(snapshot())) return mark("drop", "draft-moved");
          show(data.hint);
        } catch (error) {
          if (!controller.signal.aborted) mark("error", String(error?.name ?? error));
        } finally {
          if (abort === controller) abort = null;
          pump();
        }
      }

      /** Ask at most once per turn, and only while the composer is empty. */
      function pump() {
        if (running !== false) return;
        if (!requestable(snapshot())) return;
        if (hint !== null || abort !== null) return;
        if (requestedEpoch === epoch) return;
        requestedEpoch = epoch;
        void request();
      }

      function onState() {
        const state = snapshot();
        if (hint !== null && !stillValid(state, hint)) hide();
        if (!requestable(state)) {
          if (abort !== null) {
            abort.abort();
            abort = null;
          }
          return;
        }
        pump();
      }

      function onRunning(next) {
        const previous = running;
        running = next;
        if (next === true && previous !== true) epoch += 1;
        if (settled(previous, next)) pump();
      }

      function onKeyDown(event) {
        if (hint === null) return;
        if (event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
        const parts = composerOf(anchor());
        if (parts === null || menuOpen(parts.root)) return;
        if (!parts.root.contains(document.activeElement)) return;
        event.preventDefault();
        event.stopPropagation();
        accept();
      }

      document.addEventListener("keydown", onKeyDown, true);
      const offState = input.state.subscribe?.(onState);
      const offList = list?.subscribe?.(() => onRunning(readRunning(sessionId)));

      return {
        stop() {
          document.removeEventListener("keydown", onKeyDown, true);
          offState?.();
          offList?.();
          abort?.abort();
          hide();
        },
        accept,
        hide,
        onRunning,
      };
    }

    /** Slot component: one hidden anchor, one engine. */
    function HintHost(props) {
      const { sessionId, input, list, t, enabled, readRunning } = props;
      const anchorRef = React.useRef(null);

      React.useEffect(() => {
        if (enabled === false || input?.state === undefined) return undefined;
        const engine = createEngine({
          sessionId,
          input,
          t,
          list,
          readRunning,
          anchor: () => anchorRef.current,
        });
        return () => engine.stop();
      }, [sessionId, input, enabled]);

      return React.createElement("span", { ref: anchorRef, hidden: true, "data-next-hint-anchor": SLOT_ID });
    }

    /** Mount the browser half. */
    exports.apply = function apply(ctx, config) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "next-hint: dictionaries");
      ctx.inject(["slots", "sessions"], (scope) => {
        scope.slots.inject("conversation.composer.dock", () =>
          scope.slots.register(
            {
              name: "conversation.composer.dock",
              id: SLOT_ID,
              order: 50,
              locale: NS,
              inject: (sessionId) => {
                const actx = scope.sessions.scope(sessionId);
                const conversation = actx?.get?.("conversation");
                const list = scope.sessions.list;
                return {
                  sessionId,
                  input: conversation?.input?.for(actx),
                  list,
                  enabled: config?.enabled !== false,
                  readRunning: (id) => list?.getSnapshot?.()?.byId?.[id]?.running,
                };
              },
            },
            HintHost,
          ),
        );
      });
    };

    /** Pure helpers, reachable only from node:test (the bundle has no other entry). */
    exports.__internals = { ROUTE_PATH, NS, settled, requestable, stillValid, composerOf, menuOpen, createEngine };

    return module.exports;
  },
});
