# DESKTOP04 · 有重点的视听陪练

## 用户问题与本次范围
桌面风景模式下，通知试图滚动到未渲染的历史提示；右下方的大面板既遮景，又使教学内容没有主次。用户还希望教学不再寂静死板，并增强桌面动态。本版保留实际模型、语音传输、速度、提示判定、文章与表达本存储，只改变内容呈现和可选感官反馈。

## 已采用的研究依据
1. Ozcelik, Arslan-Ari & Cagiltay (2010), Why does signaling enhance multimedia learning? Evidence from eye movements. Computers in Human Behavior. DOI 10.1016/j.chb.2009.09.001. 原研究在40名本科生的图文材料上比较提示与无提示，发现注意可以被引到相关部分，迁移与匹配表现得到改善。作者机构记录：https://open.metu.edu.tr/handle/11511/28180 。设计推论：与其让整块区域都发光，不如标出一句中的实际改动；这不是本App的效果证明。
2. Rodemer et al. (2022), Dynamic signals in instructional videos support students to navigate through complex representations: An eye-tracking study. Applied Cognitive Psychology 36(4), 852–863. DOI 10.1002/acp.3973. 28名化学本科生观看视频的实验，动态信号有助于定位相关表征并提高该实验的保持表现。作者机构记录：https://www.leibniz-ipn.de/en/research/publications/dynamic-signals-in-instructional-videos-support-students-to-navigate-through-complex-representations 。因此这里只在新结果到达时使用一次短暂强调，不让日文持续闪动。
3. W3C Audio Control https://www.w3.org/WAI/WCAG21/Understanding/audio-control 和 Animation from Interactions https://w3c.github.io/wcag/understanding/animation-from-interactions.html 要求避免不可控音频与非必要动态干扰。本版音效默认关闭、独立音量，动态可关闭并遵守系统减少动态偏好。这里不宣称整个应用已经通过完整WCAG认证。
4. Web Audio API best practices：https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices 。只在明确用户动作后建立/恢复可选音效上下文，妥善停止节点，浏览器拒绝时不影响语音主链路。

## 设计决策：不是“越吵越记得住”
短音效的定位是状态辨识和轻微的节奏感，而非特殊频率、脑波或多巴胺疗效。没有证据可以让我们宣称这组音效会使日语记忆提升某个百分比。未增加整场背景音乐、循环警报、错误蜂鸣器或全屏庆祝。

采用3类主要反馈：准备好/提示揭开，意思传达的短和弦，需要再调整的柔和提示。收藏成功也可有短反馈。每段少于0.4秒，同类操作节流，不积压播放队列。开麦（即使尚未说话）、AI语音播放或准备、其他有声媒体播放、页面不可见时，音效停止/跳过。被跳过的音效不会稍后突然补播。音效不改变语音音高、速度、文本或模型。

## 视觉与交互
- 桌面>=1100px：左侧风景与对话，右侧单实例教师栏。卡片和字幕独立，较早提示可折叠。
- 小屏：新提示先切换到能渲染卡片的历史视图，然后展开定位。
- 练习：想表达→试一句→带走；结果先展示实际判定，再展示参考日文和准确字符差异。没有建议时显示用户原句。
- 完整原始教师说明保留在可展开区域，不由前端编造语法理由。
- “看变化”是字面差异，不将所有差异解释为错误。可选润色与不确定判定保持区分。
- “遮住试说”仅是自我回忆入口；不是自动判定掌握，也不伪装为逐字同步跟读。示范仍通过现有示范接口。
- 桌面增强雨幕、前景玻璃雨滴和雾流；沿用已发布4K素材，不冒充重新制作的全动态电影。画布像素预算有限，后台、减少动态、节流网络与细读练习时会暂停。

## 验证边界
单元测试检查文本保持、差异、语音优先级和短包络。真实浏览器验证侧栏、手机提示、选词工具、练习各状态、响应式布局和Web Audio实际渲染。语音与教师接口在UI回归中用固定测试数据替代，避免对用户真实学习记录和费用产生影响；后台实现不变。

实体iPhone长按、扬声器音色主观听感、持续真人语音与增强动态并行的性能仍需设备体验，不能由浏览器模拟冒充。长期效果应比较延迟回忆、独立表达、放弃率和对打扰的反馈，而不是只统计点亮次数。
