# 艾欧泽亚冒险记 · Eorzea Fan Tribute

一个在浏览器里运行的 3D 同人游戏，致敬《最终幻想XIV》新生篇的城镇、野外与副本体验。

**在线试玩：** https://claude.ai/artifact/T5xpA4D2RMB6DoNhtHCeWA

> 非官方粉丝致敬作品，与 SQUARE ENIX 无任何关联。项目不包含任何官方素材：所有模型、贴图、图标与音乐均由代码在运行时程序化生成，旋律为原创。

## 内容

- **角色创建**：8 个种族、16 个部族；身高、体型、耳朵/角/尾巴、眼型、眉毛、嘴型、面部彩绘、8 种发型与配色；命名日与守护神。可勾选「快速体验」直接从 Lv15 开始。
- **6 个职业**：剑术师、斧术师、枪术师、弓箭手、幻术师、咒术师。包含公共冷却、连击、咏唱与打断、持续伤害、触发效果、星极火/灵极冰、仇恨、极限技。
- **3 张地图**
  - 利姆萨·罗敏萨：以太之光广场、溺水海豚亭、码头、西风门、陆行鸟房
  - 拉诺西亚低地：盛夏农庄、风车、采集点，以及 FATE「沙哈金族的奇袭」
  - 天然要害沙斯塔夏溶洞：3 个头目，带范围预兆、死刑、分摊、召唤小怪、击退与区域封锁
- **剧情**：5 个主线任务、4 个支线任务，开场、以太之光共鸣、拂晓血盟登场与结局过场动画。
- **亲信战友**：副本中与桑克瑞德、阿尔菲诺、伊达、雅·修特拉组队，他们会躲避范围攻击、治疗与复活。
- **界面**：热键栏、队伍列表、目标栏、仇恨列表、小地图与大地图、任务追踪、任务搜索器、战利品分配、艾欧泽亚时间。
- 陆行鸟坐骑、情感动作（`/wave` `/dance` 等）、传送、自动存档（浏览器本地存储）、低帧率时自动降低画质。

## 操作

| 按键 | 功能 |
| --- | --- |
| W A S D | 移动 |
| 鼠标拖动 / 滚轮 | 旋转与缩放视角 |
| Tab / 鼠标点击 | 选择目标 |
| 1 ~ 0、-、= | 热键栏技能 |
| Shift + 1~5 | 冲刺、回复药、坐骑、极限技、返回 |
| F | 交谈 / 调查 |
| Space | 跳跃 |
| V | 召唤 / 解除坐骑 |
| C I J M U E | 角色、物品、任务日志、地图、任务搜索器、情感动作 |
| Enter | 聊天输入 |
| Esc | 取消目标 / 关闭窗口 / 跳过过场动画 |

## 构建

与 [claude-opus-5-5-demo](https://github.com/riba2534/claude-opus-5-5-demo) 相同的方案：esbuild 把 `js/` 下的全部模块连同 three.js 打包，内联进单个 `dist/index.html`。产物约 1 MB，运行时不依赖 CDN（仅界面字体来自 Google Fonts，加载失败会回退到系统字体），可以直接用浏览器打开。

```bash
npm install
npm run build        # 输出 dist/index.html（压缩）
npm run build:dev    # 不压缩，便于调试
```

## 部署到 Cloudflare Pages

使用 wrangler 直接上传 `dist/`，配置见 `wrangler.jsonc`（项目名 `eorzea-fan-tribute`）。

```bash
npx wrangler login   # 首次使用需要登录 Cloudflare
npm run deploy       # 构建并部署
npm run preview      # 本地用 Cloudflare 运行时预览
```

## 不构建直接运行

根目录的 `index.html` 也可以直接作为开发版使用：它通过 importmap 从 jsDelivr 加载 three.js r160（需要联网），并且要用 HTTP 服务打开（直接双击无法加载 ES 模块）：

```bash
npx serve .          # 或 python -m http.server 8000
```

## 代码结构

| 文件 | 说明 |
| --- | --- |
| `index.html` | 页面结构与全部界面样式（开发版入口，也是构建模板） |
| `build.mjs` | esbuild 构建脚本，生成单文件 `dist/index.html` |
| `wrangler.jsonc` | Cloudflare Pages 部署配置 |
| `js/main.js` | 主循环、标题与角色创建、地图加载、玩家控制、镜头、输入、存档 |
| `js/engine.js` | 渲染器、后期辉光、天空与海面着色器、粒子、静态合批、程序化贴图 |
| `js/character.js` | 人形骨架、捏脸贴图、发型、装备与武器、动作；魔物与陆行鸟模型 |
| `js/zones.js` | 城镇、野外、副本的场景搭建与可行走区域 |
| `js/combat.js` | 战斗系统、队友与敌人 AI、Boss 机制时间轴、极限技 |
| `js/story.js` | 任务流程、对话、过场动画、FATE、副本流程与战利品 |
| `js/ui.js` | 图标生成、HUD、窗口、小地图、名牌与伤害数字、角色创建面板 |
| `js/data.js` | 种族、职业与技能、物品、魔物、NPC、任务文本 |
| `js/vfx.js` | 技能特效、范围预兆、魔法阵、投射物 |
| `js/audio.js` | WebAudio 实时合成的配乐与音效 |
