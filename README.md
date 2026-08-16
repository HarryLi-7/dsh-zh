# dsh-zh — DSH 界面汉化（显示层）+ 官方适配检测

纯 client 插件。把 DSH Web 界面里残留的英文 UI chrome 换成中文，**只改显示文字，不碰任何功能**；并检测官方是否已自己适配。

## 功能

### 1. 界面汉化（显示层）
只替换以下**整文本节点**的显示内容（值、属性、事件、会话内容一概不动）：

| 位置 | 英文 | 中文 |
|---|---|---|
| 命令面板 `/` | Compact older conversation history | 压缩较旧的会话历史 |
| 命令面板 `/` | Download this Session log as a ZIP archive | 导出本会话日志为 ZIP 压缩包 |
| 命令面板 `/` | record feedback about this session | 记录对本会话的反馈 |
| 命令面板 `/` | set or view the goal for a long-running task | 查看或设置长期任务的目标 |
| 命令面板 `/` | Switch the permission preset (sandbox mode + approval policy) | 切换权限预设（沙箱模式 + 审批策略） |
| 命令面板 `/` | Enter or leave plan mode | 进入或退出计划模式 |
| 权限预设 | Read Only | 只读 |
| 权限预设 | Workspace Write | 工作区写入 |
| 权限预设 | Full access | 完全访问（文字与图标用橙红强调色 #ff5722） |
| 推理等级（菜单内） | Off / High / Max / Default | 关闭 / 高 / 最高 / 默认 |
| 确认弹窗 | 确认启用 Full access？ | 确认启用完全访问？ |

- 命令名（`/compact` 等）**不翻译**——它们是输入标识符。
- **Full access（完全访问）强调色**：在底部权限选择器、`/permission` 弹窗、设置页「权限」行中，`完全访问` 的文字与图标（SVG 继承 `currentColor`）使用橙色与红色之间的强调色 `#ff5722`；关闭开关时一并还原。
- **运行状态光影**：官方在系统开启"减弱动态效果"（`prefers-reduced-motion`）时停用"深度思考中"的 shimmer 动画；本插件强制恢复光影流动（仅作用于该状态容器，不影响其他界面）。
- 短通用词（Off/High/Max/Default）只在 `role="menu"` / `role="listbox"` / `aria-haspopup="menu"` 的菜单类表面内替换，绝不会动到用户消息、助手回复、工具结果、代码块、输入框。
- 会话内容（`[data-chat-flow]` / `[data-chat-flow-kind]` / 思考块 / 工具视图）整区跳过。
- 功能零影响：权限预设的机器值（`read-only` / `workspace-write` / `danger-full-access`）、推理等级 id（`off` / `high` / `max`）、命令名全部保持原样，只是屏幕上显示的中文不同。

### 2. 官方适配检测
每次页面加载静默探测一次官方宿主数据（3 条只读 RPC）：

- `commands.list` → 比对 6 条命令描述的英文原文；
- 权限设置 schema → 比对 3 个预设名；
- 当前模型（deepseek 系）→ 比对推理等级名。

**只要官方把其中任何一条改成中文或改了文案**，页面顶部显示一次性提示条（如「官方已适配：/ compact、权限预设…」），可点「知道了」关闭。同一结果不重复提示；探测失败（连接未就绪）不记录，下次加载重试。

### 3. 存储纪律（零增长日志）
- 只用 localStorage 两个固定键：`dsh-zh.enabled`、`dsh-zh.lastProbe`（常量大小，覆盖写入，绝不追加）。
- 全程不使用 `ctx.logger`，不产生任何会话日志。
- 替换记录 Map 只保留仍挂载在文档中的节点，自动清理。

## 开关

设置 → 通用设置 → 「界面汉化（中文）」（开关）。关闭 = 立即停止汉化并把已替换的文本还原为原文；重新打开 = 重新生效。

## 安装

```bash
dsh plugin --profile web add ~/.dsh/profiles/packages/dsh-zh
```

client 端改动刷新页面即可；**新增插件需要重启 harness 才载入**（由你手动重启）。

## 卸载

```bash
dsh plugin --profile web remove dsh-zh
```
