# 第一章 · 雨后的约定

独立候选分支：`nihongo-chapter1-living-local-20260906`。基于 Cat V2.1 `a80029abc3923031afc81f65d66dff7c4f169af7`。没有部署、合并或修改旧游戏/NHK。家中场景草稿保留在独立工作区，本轮暂停推进。

## 体验

本机预览：<http://127.0.0.1:8782/>。点击原有店铺热点，再选“推门进店”；也可从屏幕下缘“散步”进入便当店或沿巷去钱汤。

一条连续路线：雨后小巷 → 志乃的便当店 → 巷尾钱汤门前 → 浴场 → 钱汤门前 → 回便当店取晚饭 → 小巷里的拿铁。

- 志乃替你留晚饭，去钱汤有了来由；回店会接续“约好的便当”，不会重新当陌生人招呼。先去钱汤也有独立回应，不会凭空出现订餐记录。
- 拿铁留在原街景的屋檐下，尺寸沿用已接受的 `.045` 主图宽度。室内不复制一只猫，离开街景期间保留它原来的姿态与位置；尚未模拟离屏活动。
- 对白来自画外，日语为主，中文按需展开。看景/返回随时可用，没有课程卡片或强制等待。当前是短篇流程候选，未声称已有 5–10 分钟成熟叙事。
- 新增三张全屏原画及真实浏览器局部动画：店内热气、暖灯变化和窗外微视差；钱汤门帘微风；浴池水面、反光与缓慢上升的水汽。暂停和 reduced motion 同时覆盖新旧场景。
- 继续使用原音乐/环境声系统；入店降低街道环境声，浴场更安静，室内猫声音总线静音，返回恢复。未增加付费服务或新依赖。

## 文件

- 原始生成图：`art-source/living-scene/chapter1-v1/{shop,sento,bath}.png`
- 输入角色/提示词/来源：同目录 `generation-prompts.json`、`assets.json`，以及本目录 `PROVENANCE.md`
- 可编辑实时效果与流程：`prototypes/living-scene/src/{chapter.js,chapter.css,room-renderer.js}`
- 运行图片：`prototypes/living-scene/public/chapter1/`，与原始 PNG 字节相同
- 实际截图：`evidence/{shop-clean,sento-clean,bath-clean,shop-promise,bath-return-thought,shop-return}.png`
- 第二个水面时刻：`evidence/bath-motion-later.png`；区域变化记录 `motion-frame-comparison.json`
- 实际浏览器录屏及原页面声音：`evidence/chapter-tour.mp4`；时间与声音记录 `recording.json`
- 浏览器检查：`evidence/browser-check.json`；可复查脚本 `prototypes/living-scene/tools/{verify-chapter,record-chapter}.mjs`

## 验证与边界

Chrome 真机完成 18 项检查：原五处热点、订餐/泡澡/取餐状态、反向顺序、按需解释、返回焦点路径、刷新保留本章状态、实时动画时钟、暂停/reduced motion、猫与声音的室内外关系、无浏览器运行错误。新状态仅使用 sessionStorage `livingScene.chapter1.v1`；畸形/未知版本不会覆盖原记录。

`pnpm build` 成功，仍有既有体积提示。本轮没有 FPS 对照、跨设备性能优化或 NHK 回归。两张真实浴场帧对比显示水面与蒸汽区域发生变化，左侧固体墙面保持基本稳定；这些数据用于辨别实际动画，不是帧率数据。

构建后的 8782 预览另行验证了图片加载失败时保留原场景、重试恢复、区域动画运行。最终录屏约 52 秒，1600×900、15 fps 交付编码；Chrome 确认视频可解码并包含同页双声道音轨，详见 `evidence/{release-check,video-check,recording}.json`。该编码帧率不代表实时渲染帧率。

三张新母图实际均为 **1672×941**；浏览器截图为 1920×1080 展示，不代表原生高分辨率制作。图像是单层可编辑栅格源；局部动态采用手工定义的图像区域和着色器，不冒充语义抠图、深度重建或完整 3D 室内。

尚待 Sol/用户审核：三处新画面的正式美术验收、店内与街景逆向视角的建筑关系、局部印刷字样精修、门帘边缘和蒸汽形态、浴场专用水声与最终耳机听审。当前把更衣/洗身作为过渡文字，没有完整更衣室镜头；没有人物出镜动画、拿铁跟随进店或真实空间漫游。应先精修这一章，再扩大地点数量。
