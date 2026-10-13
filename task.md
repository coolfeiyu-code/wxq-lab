# 王者万象棋 AI 实战助手：项目交接任务

## 1. 项目基本信息

- 项目名称：万象棋 AI 实战助手（仓库名 wxq-lab）
- 项目目标：赛前按本局棋手和禁用阵营查阵容，赛中用悬浮窗看手册和手记，赛后用真实记录做复盘和战绩统计。不读取游戏画面，不替用户操作。
- 当前正式版本：1.0.0
- 当前开发状态：1.0.0 已能在本机使用。跨电脑和 GitHub Release 未完成。
- 最后更新时间：2026-10-13
- 当前 Git 分支：main
- 当前工作区是否存在未提交修改：源码已推到 origin/main，最新为 `323800c` 之后的推送状态补记。是否还有新的未提交修改，以 `git status` 为准。
- GitHub 仓库地址：https://github.com/coolfeiyu-code/wxq-lab.git
- 上游：https://github.com/zerozhh/wxq-lab.git 。本机没有可用的 `upstream/main` 对比，分叉差距未知。不要假定和上游一致。
- 极空间同步目录：`C:\AI 云同步\`（Syncthing 文件夹，配置在 `%APPDATA%\zspace\13588849616\.config\folderstate.json`）
- 正式成品目录：`C:\AI 云同步\万象棋AI实战助手\`

## 2. 项目现状

- 当前技术栈：Vue 3 + Vite + TypeScript + vue-router hash + Tailwind v4。数据服务 `scripts/serve.mjs`。逻辑在 `scripts/lib/assistant-core.mjs`，Vite 用 `@core` 打进前端，类型在 `scripts/lib/assistant-core.d.ts`。悬浮窗是 .NET 10 WinForms + WebView2，不是 Tauri。
- 主要目录：`ui/` 前端，`scripts/` 服务和逻辑，`data/` 卡牌与快照，`data/playbooks/` 手册，`desktop/WxqOverlay/` 悬浮窗，`docs/` 使用说明。个人战绩不在仓库里。
- 关键文件：`VERSION`、`scripts/lib/assistant-core.mjs`、`scripts/assistant-store.mjs`、`scripts/serve.mjs`、`ui/src/assistant/useAssist.ts`、`desktop/WxqOverlay/Program.cs`、`scripts/publish-assistant.mjs`
- 应用启动方式：开发用 `npm run dev` 或构建后 `npm run ui`，浏览器打开 http://localhost:5177/#/assist 。正式悬浮窗双击 `万象棋AI实战助手/启动悬浮窗.bat`。
- 构建命令：在 `ui/` 执行 `npm run build`（vue-tsc + vite，产物在仓库 `dist/`）。悬浮窗：`dotnet publish desktop/WxqOverlay/WxqOverlay.csproj -c Release -r win-x64 --self-contained true -o desktop/WxqOverlay/publish/win-x64`。再执行 `node scripts/publish-assistant.mjs` 拷到同步目录。
- 测试命令：仓库根目录 `npm test`
- 数据更新命令：`npm run ui` 后点顶栏「更新数据」，或 `./scripts/update.sh`。本机 IP 曾被数据源拒绝。悬浮窗里的更新接口返回 501，不在窗里抓数据。
- 数据存储方式：社区统计是 `data/meta/<日期>/` 的 JSON。个人战绩是 `万象棋AI实战助手/user-data/matches.json`，原子替换，保留 15 份备份。没有 SQLite。浏览器连不上 API 时才落到 localStorage `wxq.assistant.matches.v1`。
- 当前版本适配情况：统计快照 2026-10-12。卡牌原文 2026-09-14。游戏版本号未核验。

## 3. 已完成功能

- 开局推荐：三名特邀、一个禁用阵营、`wxq-score-v1`、样本不足单独列出、禁用冲突整套排除。无头 Chrome 验证过河洛会拦住花木兰女武神。
- 手册：8 本，`data/playbooks/catalog.json`，统计日 2026-10-12。日期不同会标待重核。
- 手动追踪：修改、撤销、重做、暂停、结束。名次选择只有 1 到 6。无头 Chrome 验证过撤销和重做。
- 本地复盘：`reviewMatch`，单元测试确认不会只凭名次编造操作错误。
- 个人战绩：分组统计，非法名次不进样本。导入第 8 名会保留原值。保存第 7 名返回 400。
- 悬浮窗：本机进程能起，`--self-test` 退出码 0，HTTP `/version.json` 为 1.0.0，`/data/heroes.json` 返回 200。PrintWindow 采到推荐页、快照日期和棋手按钮。
- 版本号：`VERSION` 与两个 package.json、`ui/public/version.json` 都是 1.0.0，有测试锁住。
- 成品目录已更新，版本文件是 1.0.0。网页、exe、英雄库、2026-10-12 快照、手册都在。

## 4. 正在进行的任务

没有进行中的编码任务。本交接停在文档和发布状态。

## 5. 待办事项

### P0

- 目标：确认第二台电脑能打开 1.0.0。验收：同步完成后双击 `启动悬浮窗.bat`，窗口标题含 1.0.0，开局页能读到 2026-10-12。依赖：极空间同步和那台电脑的 WebView2。状态：未做。
- 目标：极空间是否已重新加载 `.stignore`。验收：另一台不再同步 `wxq-lab/.git`、`node_modules`、`dist`，同时仍有 `万象棋AI实战助手/app/windows/WxqOverlay.exe`。状态：规则已写入 `C:\AI 云同步\.stignore`，客户端界面未确认。

### P1

- 目标：悬浮窗右缘不再裁棋手名。验收：PrintWindow 里四字棋手名完整，且窗口不会比屏幕还高。状态：已把请求尺寸调到 700×1040 来抵消这台机器上大约 0.67 的显示差，右缘仍可能裁到一个名字。
- 目标：补公孙离融合、露娜孙悟空核心的手册，或在推荐里明确写「没有手册」。验收：采用后手册页不会像有操作那样空着。状态：现在没有单独手册，页面会说明没有手册。
- 目标：新的统计快照。验收：`fetch-meta` 得到 `code===1` 的新日期目录，手册标成待重核，不能把探测结果当成新快照。状态：2026-10-13 只做了探测，数字和 2026-10-12 相同，没有落新目录。
- 目标：把约 v1.5.1 的卡牌改动核进 `data/heroes.json`，或继续在数据页标明未合并。状态：未合并。嬴政能量、司空震等级链仍是待核验。

### P2

- 目标：去掉 WebView2 包带来的 WindowsBase MSB3277 警告。验收：Release 构建 0 警告。状态：未做，不影响本次启动。
- 目标：和上游 `zerozhh/wxq-lab` 做一次可审查的增量比较。验收：记录双方提交差和冲突文件，不直接覆盖。状态：未 fetch。
- 目标：`data/meta/2026-10-12/summary.md` 热门阵容名打印成 undefined。验收：简报里的阵容名是英雄名。状态：原有问题，这次没改。

## 6. 已知问题与风险

- 跨电脑未验证。不能写成已经同步成功。
- 两台电脑不能同时写 `matches.json`。Node 和悬浮窗共用 `writer.lock`，2 分钟过期。强制结束进程不会立刻删锁。
- 悬浮窗和 `npm run ui` 如果同时写同一份 user-data，后开的保存会 409。请只开一个写入端。
- 游戏版本号未核验。手册机制句来自 2026-09-14 卡面，不能当成 2026-10 以后的现行规则。
- 推荐分不是胜率。没有棋手条件样本时，几名棋手的排序分相同，页面会写明这一点。
- 热门阵容首页不是全量。comp-stats 才是无偏样本。首页多出来的阵容标了「不是全量」。
- 编译警告 MSB3277。生成成功。
- 本机数据源 IP 以前被封。更新失败时必须留着上一份快照。
- 旧复盘页 `ui/src/stores/match.ts` 的 localStorage `wxq.matches` 和个人战绩不是同一份数据。

## 7. 数据与游戏版本

- 统计：`data/meta/2026-10-12`，comp-stats 查询时间 2026-10-12T06:43:31.187Z。全局对局数以该文件为准，不要另写一个数。
- 卡牌：`data/heroes.json` 等，updatedAt 2026-09-14。
- 2026-10-13 探测记录在 `data/assistant/source-status.json`。探测不是新快照。
- 游戏版本：待核验。
- 王者营地：没有确认可用的万象棋对局接口。不做导入器。
- 评分：`wxq-score-v1`。改权重必须改公式 id，并写入 CHANGELOG。

## 8. 重要技术决策

- 沿用现有 Vue 应用，不重写。实战页是新路由，旧页面保留。
- 逻辑放在无依赖的 `assistant-core.mjs`，测试和界面共用。Vue 响应式对象不能 `structuredClone`，写入前会退回 JSON 拷贝。
- 个人战绩用 JSON 文件，不用 SQLite。同步盘不能当并发数据库。
- 悬浮窗用已安装的 .NET 10，不用 Tauri。本机没有 rustc。成品用 `win-x64` self-contained，其他电脑不用另装 .NET，但仍要有 WebView2。
- 成品和仓库分开。`dist/`、`node_modules/`、`desktop/**/bin|obj|publish` 不进 Git。正式 exe 在同步目录。
- `.git` 不通过极空间同步，避免两台电脑写坏仓库。源码以 GitHub 为准。
- 不开发截图识别、OCR、对局内自动代打。`scripts/screenshot.mjs` 是 Playwright 界面回归。

## 9. 版本和发布状态

- 当前版本：1.0.0
- 最近变更：见 `CHANGELOG.md`
- 构建：2026-10-13，`ui` 的 `npm run build` 成功；`dotnet publish` self-contained 成功，有 1 个 MSB3277 警告。
- 本机启动：成品 exe 自测退出码 0；窗口内容用 PrintWindow 看到推荐页。
- GitHub 发布状态：`main` 已推到 origin，范围 `4cb2fe1..323800c`。第一次推送曾因 schannel SSL 握手失败，2026-10-13 重试成功。没有 GitHub Release。成品 exe 不在 GitHub，在极空间目录。
- 极空间成品：`C:\AI 云同步\万象棋AI实战助手` 已拷入 1.0.0 的网页、exe、数据和说明。另一台电脑未核对。

## 10. 极空间同步与目录规则

- 同步根目录：`C:\AI 云同步\`
- 要同步：`万象棋AI实战助手/` 整夹，含 `app/windows`、`app/web`、`data`、`user-data`、`docs`、`VERSION`、`README.md`、`启动悬浮窗.bat`。仓库里的 `task.md` 和 `CHANGELOG.md` 也会被拷进成品夹。
- 排除：`C:\AI 云同步\.stignore` 追加了 `wxq-lab/node_modules`、`wxq-lab/ui/node_modules`、`wxq-lab/dist`、`wxq-lab/ui/dist`、`wxq-lab/coverage`、`wxq-lab/desktop/WxqOverlay/bin`、`wxq-lab/desktop/WxqOverlay/obj`、`wxq-lab/desktop/WxqOverlay/publish`、`wxq-lab/**/*.log`、`wxq-lab/.git`。
- 没有排除 `万象棋AI实战助手`、`user-data`、`data/meta`。
- 验证：本机文件都在。客户端是否重载忽略规则、另一台是否收到，未验证。

## 11. 最近一次工作交接

- 本次完成了什么：1.0.0 的推荐、手册、追踪、本地复盘、战绩、悬浮窗和成品目录。修了采用阵容时 Vue 代理无法克隆的问题。悬浮窗和 Node 共用写入锁。
- 修改了哪些文件：`VERSION`、`CHANGELOG.md`、`task.md`、`README.md`、`docs/使用说明.md`、`.gitignore`、`package.json`、`ui/package.json`、`ui/public/version.json`、`scripts/serve.mjs`、`scripts/lib/*`、`scripts/assistant-store.mjs`、`scripts/publish-assistant.mjs`、`ui/src` 里的实战页面和路由、`desktop/WxqOverlay/`、`data/playbooks/`、`data/assistant/`。同步根的 `.stignore` 在仓库外。
- 执行了哪些测试：`npm test`；`ui` 下 `npm run build`；无头 Chrome 脚本走完开局到战绩；成品 exe `--self-test`；本机启动并 PrintWindow。
- 测试是否通过：上述各项通过。Chrome 脚本结果是 `RESULT pass`。exe 自测退出码 0。
- 生成了什么成品：`C:\AI 云同步\万象棋AI实战助手`，版本 1.0.0。
- 是否更新同步目录：本机目录已更新。另一台未验证。
- 是否发布 GitHub：`main` 已推送，包含 `5bd4a95`、`26bb7ce`、`323800c`。没有 Release。
- 尚存问题：右缘在更窄窗口里可能裁字；跨电脑未验证；忽略规则未在客户端里确认；上游差距未知；游戏版本未核验。
- 下一步先做什么：等另一台电脑同步后打开悬浮窗，核对版本是 1.0.0。不要把个人战绩、密钥和编译产物提交进仓库。

## 12. 下一步执行指令

1. 源码已在 origin/main。先看 `git status`。不要提交 `data/.secrets.json`、`万象棋AI实战助手/user-data`、`desktop/WxqOverlay/publish`。
2. 没有 GitHub Release。成品继续放在极空间目录，不要把自包含 exe 整包传到 Release，除非以后单独决定。
3. 第一次推送的 schannel 错误已经用同一次 `git push origin main` 重试成功，不要再把它写成当前阻塞。
4. 等另一台电脑同步后，双击 `启动悬浮窗.bat`，核对窗口标题和 `VERSION` 都是 1.0.0，并确认 `wxq-lab/.git` 没有被同步覆盖。
5. 有新的 `code===1` 快照之后，先让手册显示待重核，再改手册内容。不要用单日数据写上分结论。
