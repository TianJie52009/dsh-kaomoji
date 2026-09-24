/**
 * dsh-kaomoji Web client half.
 *
 * 在「设置 → 通用设置」中注册一张配置卡片，通过 loopback RPC
 * （/dsh-kaomoji-settings）读写 Host 的 ~/.dsh/dsh-kaomoji.json。
 * 保存即生效：Host 收到 save 后更新提示词段，下一次回复就按新设置来。
 *
 * 采用 dsh Web 客户端的 ModuleLoader 格式（与 dsh-emoji/dsh-meme 相同）。
 */
window.__ModuleLoader__.load({
  id: "dsh-kaomoji",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const react = require("react");
    const { useState, useEffect } = react;
    const h = react.createElement;

    const NS = "dsh-kaomoji";
    const RPC_CHANNEL = "/dsh-kaomoji-settings";
    const MODES = ["off", "auto", "frequent"];
    const PLACEMENTS = ["inline", "end"];
    const DEFAULT_SETTINGS = Object.freeze({
      mode: "auto",
      placement: "inline",
      maxPerTurn: 1,
      customPrompt: "",
    });

    function normalizeSettings(value) {
      const mode = MODES.includes(value.mode) ? value.mode : DEFAULT_SETTINGS.mode;
      const placement = PLACEMENTS.includes(value.placement)
        ? value.placement
        : DEFAULT_SETTINGS.placement;
      const maxPerTurn =
        Number.isInteger(value.maxPerTurn) && value.maxPerTurn >= 1 && value.maxPerTurn <= 5
          ? value.maxPerTurn
          : DEFAULT_SETTINGS.maxPerTurn;
      const customPrompt =
        typeof value.customPrompt === "string" && value.customPrompt.length <= 4000
          ? value.customPrompt
          : "";
      return { mode, placement, maxPerTurn, customPrompt };
    }

    function cloneSettings(settings) {
      return { ...settings, customPrompt: settings.customPrompt };
    }

    const zh = {
      "row.title": "颜文字（dsh-kaomoji）",
      "row.description": "给对话回复自动加日式颜文字，词库精选自 kaomojiya.org。",
      "field.mode": "使用频率",
      "mode.off": "关闭",
      "mode.off.desc": "不使用颜文字",
      "mode.auto": "智能",
      "mode.auto.desc": "寒暄、闲聊、推荐建议、共情回复都会带一个",
      "mode.frequent": "高频",
      "mode.frequent.desc": "每条对话回复都带一个（纯代码/正式交付除外）",
      "field.placement": "放置位置",
      "placement.inline": "贴合句子",
      "placement.end": "回复结尾",
      "field.max": "每条上限",
      "field.prompt": "附加提示词",
      "prompt.placeholder": "例如：正式场景克制一点，优先使用「感谢 / 鼓励」类颜文字",
      "prompt.help": "只细化风格与场景，不能改变模式、白名单或数量上限。",
      "action.reset": "恢复默认",
      "status.loading": "正在读取设置…",
      "status.saved": "已保存，下一次回复生效。",
      "status.unsupported": "Host 未加载颜文字插件或该来源不被信任，无法保存设置。",
      "status.forbidden": "当前来源不在 Host 的信任列表里，无法保存设置。",
      "status.error": "保存失败，请重试。",
    };

    const en = {
      "row.title": "Kaomoji (dsh-kaomoji)",
      "row.description": "Add Japanese kaomoji to replies; curated from kaomojiya.org.",
      "field.mode": "Frequency",
      "mode.off": "Off",
      "mode.off.desc": "No kaomoji",
      "mode.auto": "Smart",
      "mode.auto.desc": "Greetings, casual chat, recommendations and empathetic replies get one",
      "mode.frequent": "Frequent",
      "mode.frequent.desc": "One kaomoji in every conversational reply (code-only/formal excluded)",
      "field.placement": "Placement",
      "placement.inline": "After best-matching sentence",
      "placement.end": "End of reply",
      "field.max": "Max per reply",
      "field.prompt": "Extra guidance",
      "prompt.placeholder": "e.g. Stay professional; prefer thanks/encourage kaomoji",
      "prompt.help": "Refines tone/scenes only; cannot change mode, whitelist, or limits.",
      "action.reset": "Reset to defaults",
      "status.loading": "Loading settings…",
      "status.saved": "Saved — applies to the next reply.",
      "status.unsupported": "The Host did not load the kaomoji plugin, or this origin is not trusted.",
      "status.forbidden": "This origin is not in the Host trust list, so settings cannot be saved.",
      "status.error": "Save failed, please retry.",
    };

    const styles = {
      card: {
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 16px",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 12,
        background: "var(--dsw-alias-bg-layer-3)",
        color: "var(--dsw-alias-label-primary)",
      },
      header: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
      title: { fontSize: 15, lineHeight: "21px", fontWeight: 600 },
      description: {
        fontSize: 13,
        lineHeight: "19px",
        color: "var(--dsw-alias-label-tertiary)",
      },
      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
      },
      field: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
      label: { fontSize: 13, lineHeight: "18px", fontWeight: 600 },
      modeRow: {
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
      },
      mode: {
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "8px 6px",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        background: "var(--dsw-alias-bg-module-platform)",
        color: "inherit",
        font: "inherit",
        cursor: "pointer",
      },
      modeName: { fontSize: 12, lineHeight: "18px", fontWeight: 600 },
      modeDesc: {
        fontSize: 11,
        lineHeight: "16px",
        color: "var(--dsw-alias-label-tertiary)",
      },
      select: {
        boxSizing: "border-box",
        width: "100%",
        padding: "7px 10px",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        background: "var(--dsw-alias-bg-module-platform)",
        color: "var(--dsw-alias-label-primary)",
        font: "inherit",
        fontSize: 13,
      },
      number: {
        boxSizing: "border-box",
        width: "100%",
        padding: "7px 10px",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        background: "var(--dsw-alias-bg-module-platform)",
        color: "var(--dsw-alias-label-primary)",
        font: "inherit",
        fontSize: 13,
      },
      prompt: {
        boxSizing: "border-box",
        width: "100%",
        minHeight: 72,
        resize: "vertical",
        padding: "8px 10px",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        background: "var(--dsw-alias-bg-module-platform)",
        color: "var(--dsw-alias-label-primary)",
        font: "inherit",
        fontSize: 13,
        lineHeight: 1.55,
      },
      help: {
        fontSize: 12,
        lineHeight: "18px",
        color: "var(--dsw-alias-label-tertiary)",
      },
      footer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      },
      status: { fontSize: 12, lineHeight: "18px", color: "var(--dsw-alias-label-tertiary)" },
      reset: {
        flex: "0 0 auto",
        padding: "6px 10px",
        border: "1px solid var(--dsw-alias-border-l2)",
        borderRadius: 8,
        background: "none",
        color: "var(--dsw-alias-label-secondary)",
        font: "inherit",
        fontSize: 12,
        cursor: "pointer",
      },
    };

    /**
     * 轻量快照 store（getSnapshot/subscribe），slot runtime 会把它包装成
     * useKaomoji(selector) hook。所有写操作都串行经过 loopback RPC。
     */
    function createSettingsStore(rpc) {
      let snapshot = {
        status: "loading",
        settings: cloneSettings(DEFAULT_SETTINGS),
        revision: undefined,
        writable: true,
        saveError: null,
        justSaved: false,
      };
      const listeners = new Set();
      let tail = Promise.resolve();

      const emit = () => {
        for (const listener of listeners) listener();
      };

      const publish = (patch) => {
        snapshot = patch.saveError === null
          ? { ...snapshot, ...patch, saveErrorMessage: null }
          : { ...snapshot, ...patch };
        emit();
      };

      const enqueue = (operation) => {
        const task = tail.then(operation);
        tail = task.catch(() => {});
        return task;
      };

      const fail = (code, message) => {
        publish({
          status: "unavailable",
          writable: false,
          saveError: code,
          saveErrorMessage: message || null,
          justSaved: false,
        });
      };

      const callRpc = async (endpoint, payload) => {
        try {
          const result = await rpc.call(RPC_CHANNEL, endpoint, payload);
          if (result && result.ok === true) return { value: result.value };
          const error = (result && result.error) || {};
          return {
            error: error.code === "forbidden" ? "forbidden" : "rejected",
            message: typeof error.message === "string" ? error.message : undefined,
          };
        } catch (error) {
          const message = String((error && error.message) || error || "");
          return {
            error: /403|forbidden/i.test(message) ? "forbidden" : "unreachable",
            message,
          };
        }
      };

      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        async refresh() {
          const result = await callRpc("get", {});
          if (result.error !== undefined) {
            fail(result.error === "forbidden" ? "forbidden" : "load", result.message);
            return;
          }
          const value = result.value;
          publish({
            status: "ready",
            settings: normalizeSettings(value.settings),
            revision: value.revision,
            writable: value.writable === true,
            saveError: null,
          });
        },
        patch(field) {
          if (!snapshot.writable) return Promise.resolve();
          const next = normalizeSettings({ ...snapshot.settings, ...field });
          publish({
            status: "ready",
            settings: next,
            saveError: null,
            justSaved: false,
          });
          return enqueue(async () => {
            const result = await callRpc("save", {
              settings: next,
              expectedRevision: snapshot.revision,
            });
            if (result.error !== undefined) {
              fail(result.error === "forbidden" ? "forbidden" : "save", result.message);
              return;
            }
            const value = result.value;
            publish({
              settings: normalizeSettings(value.settings),
              revision: value.revision,
              writable: value.writable === true,
              status: "ready",
              saveError: null,
              justSaved: true,
            });
          });
        },
        async reset() {
          if (!snapshot.writable) return;
          publish({ saveError: null, justSaved: false });
          const result = await callRpc("reset", { expectedRevision: snapshot.revision });
          if (result.error !== undefined) {
            fail(result.error === "forbidden" ? "forbidden" : "save", result.message);
            return;
          }
          const value = result.value;
          publish({
            settings: normalizeSettings(value.settings),
            revision: value.revision,
            status: "ready",
            saveError: null,
            justSaved: true,
          });
        },
      };
    }

    /**
     * 通用设置行（settings.general.item）。props 由 slot runtime 组装：
     * t（本插件字典）+ useKaomoji(selector) + 写操作。
     */
    function KaomojiSettingsRow(props) {
      const { t, useKaomoji } = props;
      const state = useKaomoji((value) => value);
      const settings = state.settings;
      const [promptDraft, setPromptDraft] = useState(settings.customPrompt);

      useEffect(() => {
        setPromptDraft(settings.customPrompt);
      }, [settings.customPrompt]);

      const statusText = state.saveError
        ? state.saveError === "forbidden"
          ? t("status.forbidden")
          : state.saveErrorMessage
            ? `${t("status.error")} ${state.saveErrorMessage}`
            : t("status.error")
        : state.status === "loading"
          ? t("status.loading")
          : !state.writable
            ? t("status.unsupported")
            : state.justSaved
              ? t("status.saved")
              : t("prompt.help");
      const controlsDisabled = !state.writable || state.status === "loading";

      return h(
        "section",
        { style: styles.card, "data-dsh-kaomoji-settings": "true" },
        h(
          "div",
          { style: styles.header },
          h("div", { style: styles.title }, t("row.title")),
          h("div", { style: styles.description }, t("row.description")),
        ),
        h(
          "div",
          { style: styles.grid },
          h(
            "div",
            { style: styles.field },
            h("div", { style: styles.label }, t("field.mode")),
            h(
              "div",
              { style: styles.modeRow },
              ["off", "auto", "frequent"].map((mode) =>
                h(
                  "button",
                  {
                    key: mode,
                    type: "button",
                    style: {
                      ...styles.mode,
                      borderColor:
                        settings.mode === mode
                          ? "var(--dsw-alias-label-primary)"
                          : "var(--dsw-alias-border-l2)",
                    },
                    "aria-pressed": settings.mode === mode,
                    disabled: controlsDisabled,
                    onClick: () => props.setMode(mode),
                  },
                  h("span", { style: styles.modeName }, t(`mode.${mode}`)),
                  h("span", { style: styles.modeDesc }, t(`mode.${mode}.desc`)),
                ),
              ),
            ),
          ),
          h(
            "div",
            { style: styles.field },
            h("label", { style: styles.label }, t("field.placement")),
            h(
              "select",
              {
                style: styles.select,
                value: settings.placement,
                disabled: controlsDisabled,
                onChange: (event) => props.setPlacement(event.target.value),
              },
              h("option", { value: "inline" }, t("placement.inline")),
              h("option", { value: "end" }, t("placement.end")),
            ),
          ),
          h(
            "div",
            { style: styles.field },
            h("label", { htmlFor: "dsh-kaomoji-max", style: styles.label }, t("field.max")),
            h("input", {
              id: "dsh-kaomoji-max",
              type: "number",
              min: 1,
              max: 5,
              step: 1,
              style: styles.number,
              value: String(settings.maxPerTurn),
              disabled: controlsDisabled,
              onChange: (event) => {
                const parsed = Number(event.target.value);
                if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                  props.setMaxPerTurn(parsed);
                }
              },
            }),
          ),
        ),
        h(
          "div",
          { style: styles.field },
          h("label", { htmlFor: "dsh-kaomoji-prompt", style: styles.label }, t("field.prompt")),
          h("textarea", {
            id: "dsh-kaomoji-prompt",
            style: styles.prompt,
            placeholder: t("prompt.placeholder"),
            value: promptDraft,
            disabled: controlsDisabled,
            onChange: (event) => setPromptDraft(event.target.value),
            onBlur: () => {
              if (promptDraft !== settings.customPrompt) {
                props.setCustomPrompt(promptDraft);
              }
            },
          }),
        ),
        h(
          "div",
          { style: styles.footer },
          h("div", { style: styles.status }, statusText),
          h(
            "button",
            {
              type: "button",
              style: styles.reset,
              disabled: controlsDisabled,
              onClick: () => void props.reset(),
            },
            t("action.reset"),
          ),
        ),
      );
    }

    const inject = ["slots", "locale", "connection"];

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        "dsh-kaomoji: dictionaries",
      );
      const connection = ctx.get("connection");
      const controller = createSettingsStore(connection.rpc);
      void controller.refresh();

      ctx.effect(() => {
        const disposeReset = ctx.on("connection/reset", () => void controller.refresh());
        return () => disposeReset();
      }, "dsh-kaomoji: settings invalidations");

      ctx.slots.inject("settings.general.item", () =>
        ctx.slots.register(
          {
            name: "settings.general.item",
            id: "dsh-kaomoji",
            order: 30,
            locale: NS,
            inject: () => ({
              hooks: { kaomoji: controller },
              setMode: (mode) => void controller.patch({ mode }),
              setPlacement: (placement) => void controller.patch({ placement }),
              setMaxPerTurn: (maxPerTurn) => void controller.patch({ maxPerTurn }),
              setCustomPrompt: (customPrompt) => void controller.patch({ customPrompt }),
              reset: () => controller.reset(),
            }),
          },
          KaomojiSettingsRow,
        ),
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.NS = NS;
    exports.RPC_CHANNEL = RPC_CHANNEL;
    exports.createSettingsStore = createSettingsStore;
    exports.KaomojiSettingsRow = KaomojiSettingsRow;
    return module.exports;
  },
});
