window.__ModuleLoader__.load({
  id: "dsh-zh",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const { createElement, useState } = require("react");

    /**
     * dsh-zh：界面汉化（显示层）+ 官方适配检测。
     *
     * 汉化:只替换 UI chrome(命令面板描述/权限预设名/推理等级名)的文本节点
     * 显示内容,绝不触碰任何值、属性、事件或会话内容 —— 实际功能与原生完全一致。
     *
     * 检测:每次页面加载探测一次官方宿主数据(命令描述 RPC / 权限设置 schema /
     * 当前模型推理等级),与上次探测结果不同即在屏幕上显示一次性提示条(可关闭,
     * 同结果不重复提示)。版本变化会改宿主数据 → 结果变化 → 提示;宿主单独改文案
     * (不改客户端 bundle)同样会被捕获。每次探测是 3 条只读 RPC,静默、无日志。
     *
     * 存储纪律:只用 localStorage 固定键(enabled / lastProbe),常量大小、绝不
     * 追加;全程不使用 ctx.logger,不产生任何会话日志 —— 没有持续增长的日志占用
     * 存储。替换记录 Map 只保留仍挂载在文档中的节点。
     */

    const STORAGE_KEY = "dsh-zh.enabled";
    const LAST_PROBE_KEY = "dsh-zh.lastProbe";

    /** 整节点精确替换映射:trim 后完全相等的文本节点才替换。 */
    const ZH = {
      // 命令面板描述(宿主注册时硬编码的英文)
      "Compact older conversation history": "压缩较旧的会话历史",
      "Download this Session log as a ZIP archive": "导出本会话日志为 ZIP 压缩包",
      "record feedback about this session": "记录对本会话的反馈",
      "set or view the goal for a long-running task": "查看或设置长期任务的目标",
      "Switch the permission preset (sandbox mode + approval policy)": "切换权限预设（沙箱模式 + 审批策略）",
      "Enter or leave plan mode": "进入或退出计划模式",
      // 权限预设名
      "Read Only": "只读",
      "Workspace Write": "工作区写入",
      "Full access": "完全访问",
      // 官方词典整句里嵌的 "Full access" 产品名
      "启用 Full access": "启用完全访问",
      "确认启用 Full access？": "确认启用完全访问？",
      "启用 Full access 后，新会话将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任后续任务时使用。": "启用完全访问后，新会话将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任后续任务时使用。",
      "启用 Full access 后，agent 将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。": "启用完全访问后，agent 将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。",
      // 模型运行中状态文字(位于 data-chat-flow 内但带 role="status",属 UI chrome)
      "Deep diving...": "深度思考中...",
      // 会话头部导出按钮(dsh-session-log-export 渲染,官方中文叫"会话日志")
      "Session log": "会话日志"
    };

    /** 短通用词:只在菜单类表面(listbox/menu/带菜单的触发按钮)内替换,绝不碰用户内容。 */
    const ZH_MENU = {
      "Off": "关闭",
      "High": "高",
      "Max": "最高",
      "Default": "默认"
    };
    const MENU_SCOPE = '[role="menu"], [role="listbox"], [aria-haspopup="menu"]';

    /** Full access(完全访问)强调色:橙色与红色之间。 */
    const FULL_ACCESS_COLOR = "#ff5722";
    const FULL_ACCESS_MARK = "data-dsh-zh-full-access";
    const FULL_ACCESS_STYLE = [
      `[${FULL_ACCESS_MARK}] { color: ${FULL_ACCESS_COLOR} !important; }`,
      `[${FULL_ACCESS_MARK}] svg { color: ${FULL_ACCESS_COLOR} !important; }`
    ].join("\n");

    /** "深度思考中"运行状态:官方在 prefers-reduced-motion 下停用 shimmer 动画,
     *  但用户系统开着"减弱动态效果"时希望保留光影流动 —— 用标记强制恢复。
     *  注意:起始位置必须写在 keyframes 的 from 帧里,不能写成元素的
     *  background-position !important —— !important 静态声明优先级高于动画值,
     *  会把光影锁死不动(实测踩坑)。 */
    const TURN_STATUS_MARK = "data-dsh-zh-turn-status";
    const TURN_STATUS_STYLE = [
      `[${TURN_STATUS_MARK}] { background-size: 250% 100% !important; animation: 1.8s linear infinite dsh-zh-turn-status-shimmer !important; }`,
      `@keyframes dsh-zh-turn-status-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }`
    ].join("\n");

    /** 探测用:命令名 → 我们汉化的英文描述(官方改掉其中任何一条 = 相关变更)。 */
    const COMMAND_RULES = {
      "compact": "Compact older conversation history",
      "export": "Download this Session log as a ZIP archive",
      "feedback": "record feedback about this session",
      "goal": "set or view the goal for a long-running task",
      "permission": "Switch the permission preset (sandbox mode + approval policy)",
      "plan": "Enter or leave plan mode"
    };
    const PRESET_LABELS = new Set(["Read Only", "Workspace Write", "Full access"]);
    const EFFORT_LABELS = new Set(["Off", "High", "Max"]);

    /** 跳过区域:会话内容、思考块、工具结果、输入区、代码块、自身提示条。 */
    const SKIP_SELECTOR = [
      "[data-chat-flow]",
      "[data-chat-flow-kind]",
      '[data-variant="think"]',
      '[data-slot^="tool.call"]',
      "textarea",
      "input",
      "[contenteditable]",
      "code",
      "pre",
      "[data-dsh-zh-banner]"
    ].join(",");

    /** 已替换的文本节点 → 原始内容(用于关闭开关时还原)。 */
    const replaced = new Map();
    /** 已打上 Full access 强调色标记的元素(用于关闭开关时还原)。 */
    const marked = new Set();
    let observer = null;
    let walkTimer = 0;

    function isEnabled() {
      try {
        return localStorage.getItem(STORAGE_KEY) !== "0";
      } catch {
        return true;
      }
    }

    function inSkippedZone(node) {
      const parent = node.parentElement;
      if (parent === null) return false;
      // 运行状态文字(role="status",如 "Deep diving...")位于 data-chat-flow 内
      // 但属于 UI chrome,豁免跳过区
      if (parent.closest('[role="status"]') !== null) return false;
      return parent.closest(SKIP_SELECTOR) !== null;
    }

    /** 若本次所有变更都落在跳过区域(聊天流式输出等),则无需 walk。 */
    function mutationsMatter(mutations) {
      return mutations.some((mutation) => {
        const target = mutation.target;
        if (!(target instanceof Node)) return false;
        if (target.nodeType === Node.TEXT_NODE) return !inSkippedZone(target);
        const parent = target.parentElement;
        return parent === null || parent.closest(SKIP_SELECTOR) === null;
      });
    }

    /** 替换一个文本节点(仅整节点精确匹配;短通用词限菜单类表面)。 */
    function translateNode(node) {
      const data = node.data;
      if (data.length === 0 || inSkippedZone(node)) return;
      const trimmed = data.trim();
      let value = ZH[trimmed];
      if (value === void 0) {
        const parent = node.parentElement;
        if (parent !== null && parent.closest(MENU_SCOPE) !== null) value = ZH_MENU[trimmed];
      }
      if (value === void 0) return;
      if (!replaced.has(node)) replaced.set(node, data);
      node.data = data.replace(trimmed, value);
      // Full access(完全访问)的触发按钮/菜单项:文字与图标(继承 currentColor)上强调色
      if (value === "完全访问") {
        const row = node.parentElement?.closest('button, [role="option"], [role="menuitem"], [role="menuitemradio"]');
        if (row !== void 0 && row !== null && !row.hasAttribute(FULL_ACCESS_MARK)) {
          row.setAttribute(FULL_ACCESS_MARK, "");
          marked.add(row);
        }
      }
      // "深度思考中"运行状态:标记容器以强制 shimmer 动画(绕过系统减弱动态效果)
      if (value === "深度思考中...") {
        const status = node.parentElement?.closest('[role="status"]');
        if (status !== void 0 && status !== null && !status.hasAttribute(TURN_STATUS_MARK)) {
          status.setAttribute(TURN_STATUS_MARK, "");
          marked.add(status);
        }
      }
    }

    /** 走一遍整棵 DOM 的文本节点(幂等:替换后的中文不再命中映射)。 */
    function walk(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode()) !== null) translateNode(node);
    }

    function scheduleWalk() {
      cancelAnimationFrame(walkTimer);
      walkTimer = requestAnimationFrame(() => {
        if (!isEnabled() || !document.body) return;
        // 清理已脱离文档的替换记录/标记,避免 Map/Set 无限增长(存储纪律)
        for (const node of replaced.keys()) if (!node.isConnected) replaced.delete(node);
        for (const el of marked) if (!el.isConnected) {
          el.removeAttribute(FULL_ACCESS_MARK);
          el.removeAttribute(TURN_STATUS_MARK);
          marked.delete(el);
        }
        walk(document.body);
      });
    }

    function start() {
      if (observer !== null) return;
      observer = new MutationObserver((mutations) => {
        if (!mutationsMatter(mutations)) return;
        scheduleWalk();
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      scheduleWalk();
    }

    /** 关闭:停掉观察器并把已替换的节点还原为原文、移除强调色标记。 */
    function stop() {
      if (observer !== null) {
        observer.disconnect();
        observer = null;
      }
      for (const [node, original] of replaced) {
        if (node.isConnected && node.data !== original) node.data = original;
      }
      replaced.clear();
      for (const el of marked) {
        el.removeAttribute(FULL_ACCESS_MARK);
        el.removeAttribute(TURN_STATUS_MARK);
      }
      marked.clear();
    }

    // ------------------------------------------------------------------
    // 官方适配检测
    // ------------------------------------------------------------------

    function currentSessionId(ctx) {
      try {
        const sessions = ctx.get("sessions");
        const snap = sessions?.list?.getSnapshot?.();
        return snap?.current ?? snap?.ids?.[0] ?? null;
      } catch {
        return null;
      }
    }

    /** 探测官方数据,返回已失效/已变更的规则描述数组。 */
    async function probe(ctx) {
      const changed = [];
      const sessionId = currentSessionId(ctx);
      if (sessionId === null) return { changed, probeable: false };
      let ran = 0;

      // 1) 命令描述
      try {
        const remote = ctx.get("remote");
        const res = await remote.commands.list(sessionId);
        if (res?.ok === true && Array.isArray(res.value)) {
          ran += 1;
          for (const cmd of res.value) {
            const known = COMMAND_RULES[cmd.name];
            if (known !== void 0 && cmd.description !== known) changed.push(`/ ${cmd.name}`);
          }
        }
      } catch { /* 探测失败静默,不当作变更 */ }

      // 2) 权限预设名(来自宿主 settings schema 的 defaultPreset 枚举)
      try {
        const connection = ctx.get("connection");
        const api = connection?.api;
        const resp = await api?.settings.describe({});
        const ns = resp?.result?.ok === true
          ? resp.result.value?.namespaces?.find((n) => n.ns === "permission")
          : void 0;
        if (ns !== void 0) {
          ran += 1;
          const { rehydrateSchema, nodeAtPath } = require("@deepseek-ai/dsh-client-schema-form");
          const node = nodeAtPath(rehydrateSchema(ns.schema), ["defaultPreset"]);
          const options = (node?.type === "union" ? node.list ?? [] : [node]).flatMap((candidate) => {
            if (candidate?.type !== "const" || typeof candidate.value !== "string") return [];
            const described = candidate.meta?.description;
            return [{
              value: candidate.value,
              label: typeof described === "string" && described.length > 0 ? displayPresetLabel(candidate.value, described) : displayPresetLabel(candidate.value, candidate.value)
            }];
          });
          for (const option of options) {
            if (!PRESET_LABELS.has(option.label)) changed.push(`权限预设「${option.label}」`);
          }
        }
      } catch { /* schema-form 不可用时跳过该探测 */ }

      // 3) 当前模型(仅 deepseek 系)的推理等级名 —— 直接走 RPC,不创建目录、无副作用
      try {
        const api = ctx.get("connection")?.api;
        const { result } = await api?.sessions?.models?.({ sessionId }) ?? {};
        if (result?.ok === true && result.value !== void 0) {
          ran += 1;
          const value = result.value;
          const current = value.current;
          const model = (value.groups ?? []).flatMap((g) => g.models ?? []).find((m) => m.id === current?.model);
          if (model !== void 0 && /deepseek/i.test(current?.provider ?? "")) {
            const names = (model.reasoning?.efforts ?? []).map((e) => e.name);
            if (names.length > 0 && names.some((name) => !EFFORT_LABELS.has(name))) changed.push("推理等级名");
          }
        }
      } catch { /* 模型目录不可用时跳过 */ }

      // 至少跑通一条探测才算可判定;全失败(如连接未就绪)不算,避免吞掉版本变更
      return { changed, probeable: ran > 0 };
    }

    function displayPresetLabel(value, name) {
      if (value === "danger-full-access") return "Full access";
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
      return name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    }

    /** 一次性屏幕提示条(每版本一次;关闭后同版本不再出现)。 */
    function showBanner(changed) {
      if (document.querySelector("[data-dsh-zh-banner]") !== null) return;
      const banner = document.createElement("div");
      banner.dataset.dshZhBanner = "";
      Object.assign(banner.style, {
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483000",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        maxWidth: "min(720px, calc(100vw - 32px))",
        padding: "10px 14px",
        borderRadius: "12px",
        background: "var(--dsw-alias-bg-module-platform, #ffffff)",
        border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.1))",
        boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
        color: "var(--dsw-alias-label-primary, #1f2328)",
        font: "var(--dsw-font-s-strong-13, 13px/1.5 system-ui, sans-serif)"
      });
      const text = document.createElement("span");
      text.textContent = `检测到 DSH 更新后，官方已适配/变更以下内容（dsh-zh 对应规则已自动停用）：${changed.join("、")}。`;
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.textContent = "知道了";
      Object.assign(dismiss.style, {
        flex: "none",
        padding: "4px 12px",
        borderRadius: "999px",
        border: "none",
        cursor: "pointer",
        background: "var(--dsw-alias-state-business-primary, #4d6bfe)",
        color: "#ffffff",
        font: "inherit"
      });
      dismiss.onclick = () => banner.remove();
      banner.append(text, dismiss);
      document.body.appendChild(banner);
      // 只要展示过即记录(每版本一次;再次加载同版本不再提示)
      try {
        localStorage.setItem(LAST_PROBE_KEY, changed.join("\u0000"));
      } catch { /* ignore */ }
    }

    // ------------------------------------------------------------------
    // 设置开关(通用设置 order16,紧跟 tool-fold 的 order15)
    // ------------------------------------------------------------------

    function ZhRow() {
      const [enabled, setEnabledState] = useState(isEnabled());
      const toggle = () => {
        const next = !enabled;
        try {
          localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch { /* ignore */ }
        if (next) start();
        else stop();
        setEnabledState(next);
      };

      const rowStyle = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        padding: "14px 16px",
        borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,0.08))"
      };
      const textStyle = {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "0"
      };
      const titleStyle = {
        font: "var(--dsw-font-s-strong-14)",
        color: "var(--dsw-alias-label-primary, #1f2328)"
      };
      const descStyle = {
        font: "var(--dsw-font-xs-13)",
        color: "var(--dsw-alias-label-tertiary, #8c919b)"
      };
      const trackStyle = {
        position: "relative",
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        flex: "none",
        cursor: "pointer",
        border: "none",
        padding: "0",
        transition: "background 0.15s",
        background: enabled ? "var(--dsw-alias-brand-primary, #4d6bfe)" : "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.12))"
      };
      const knobStyle = {
        position: "absolute",
        top: "2px",
        left: enabled ? "18px" : "2px",
        width: "16px",
        height: "16px",
        borderRadius: "50%",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        transition: "left 0.15s"
      };

      return createElement("div", { style: rowStyle },
        createElement("div", { style: textStyle },
          createElement("div", { style: titleStyle }, "界面汉化（中文）"),
          createElement("div", { style: descStyle }, "将命令面板描述、权限预设、推理等级等界面文字替换为中文；DSH 更新后自动检测官方是否已适配")
        ),
        createElement("button", {
          type: "button",
          role: "switch",
          "aria-checked": enabled ? "true" : "false",
          "aria-label": "界面汉化（中文）",
          style: trackStyle,
          onClick: toggle
        }, createElement("span", { style: knobStyle }))
      );
    }

    const name = "zh";
    const inject = ["slots"];

    function apply(ctx) {
      if (typeof document === "undefined") return;

      // 通用设置项(order16,紧跟 tool-fold 的 order15)
      ctx.effect(() => ctx.slots.inject("settings.general.item", () => ctx.slots.register({
        name: "settings.general.item",
        id: "zh",
        order: 16
      }, ZhRow)), "dsh-zh: general settings item");

      // Full access 强调色 + 运行状态 shimmer 动画样式(跟随插件的启用/关闭,不残留)
      const styleId = "dsh-zh-styles";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = [FULL_ACCESS_STYLE, TURN_STATUS_STYLE].join("\n");
        document.head.appendChild(style);
      }

      if (isEnabled()) {
        if (document.body) start();
        else document.addEventListener("DOMContentLoaded", start, { once: true });
      }

      // 官方适配检测:每次加载探测一次(3 次只读 RPC,静默、无日志),与上次结果
      // 不同即提示。版本变化会改变宿主数据 → 结果变化 → 提示;宿主单独改文案
      // (不改客户端 bundle)同样会被捕获。探测全失败(连接未就绪)不更新记录。
      const previous = (() => {
        try {
          return localStorage.getItem(LAST_PROBE_KEY);
        } catch {
          return null;
        }
      })();

      setTimeout(async () => {
        try {
          const { changed, probeable } = await probe(ctx);
          if (!probeable) return;
          const serialized = changed.join("\u0000");
          if (changed.length > 0 && serialized !== previous) showBanner(changed);
          // 无论有无变更都记录本次结果(相同结果不再提示;有变更时已由 showBanner 记录)
          try {
            localStorage.setItem(LAST_PROBE_KEY, serialized);
          } catch { /* ignore */ }
        } catch { /* 探测异常:不更新记录,下次加载重试 */ }
      }, 3000);
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.ZhRow = ZhRow;
    exports.isEnabled = isEnabled;
    return module.exports;
  }
});
