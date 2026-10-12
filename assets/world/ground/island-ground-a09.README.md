# A09-IS · 云岛草地与小花三款

按最新 CODEX_QUEUE 的明亮云岛方向，交付三张独立地面基色。第 1 轮待 Claude 审核，通过数 0，尚未接入。每张都由独立的真实 `image_gen.imagegen` 调用产生，原稿、完整 prompt、工具参数、调用时间、导出方式与 SHA 见 [出处记录](island-ground-a09.provenance.json)。

| 名称 / ID | 文件 | 尺寸 / 编码 | 字节 |
| --- | --- | --- | ---: |
| 薄荷小花 `ground_island_mint_bloom_01` | [WebP](ground_island_mint_bloom_01.webp) | 1024² RGB / sRGB ICC / WebP q90 | 300178 |
| 粉绿三叶草 `ground_island_pink_clover_02` | [WebP](ground_island_pink_clover_02.webp) | 1024² RGB / sRGB ICC / WebP q90 | 479916 |
| 混色草甸 `ground_island_meadow_mix_03` | [WebP](ground_island_meadow_mix_03.webp) | 1024² RGB / sRGB ICC / WebP q90 | 297664 |

三张实际原生图均为 1254² RGB。提示词请求最高可用方形分辨率，实际工具返回尺寸以上述原稿为准；保留完整画布，用 Pillow Lanczos 等比降到 1024²，再以 WebP quality 90 / method 6 编码。嵌入同一 588 B sRGB ICC。没有裁切、补边、调色、绘制接缝或上采样。原稿 2.79～3.62 MB 保留在工作空间和原工具输出位置，不作为超预算文件提交；出处中的原始哈希与归档副本一致。

草地底色依据当前 cloud.ts 的 #9AD87A，小花沿用其白、淡粉、淡黄和浅蓝色板；只参考主题和颜色，画面艺术内容由图片生成工具产生。第一张草尖与少量白粉五瓣花，第二张以圆叶三叶草和粉白花球为主，第三张加入白 / 淡黄 / 浅蓝小花。没有天空、道路、建筑或整个岛屿边界。

拍摄基线67的游戏草地为 CircleGeometry，半径29.2、repeat5×5、白色 MeshStandardMaterial，roughness .95 / metalness0。最新6f已接入ambientCG Grass005：加载成功时repeat4×4（约14.6世界单位/周期），旧程序草地repeat5仅为fallback。材质与半径不变；本批实拍仍是独立Plane8/repeat2，不把旧图重标为最新游戏截图。纹理可供 Claude 之后接入替换；本批不修改场景代码或资源注册。独立 Three 材质预览沿用这组材质和 ATMOS.mist 的正午光照，预览平面及 UV 尺度与实际岛面不同，具体参数和实拍加载证据随审图说明保存。

最不满意：第二张叶片与花球较密，缩小时偏碎；大形草簇和花朵在 4×4 平铺时仍有周期重复。花朵会受实际相机高度、UV 缩放与光照影响。这些是待 Claude 按游戏尺度评估的限制。只交付基色，没有法线、位移、粗糙度图或发光图。

[审核缩略图与平铺](../reviews/island-ground-a09.webp) · [实际白光 / 正午光材质预览](../reviews/island-ground-a09-lighting.webp) · [截图方法](../reviews/island-ground-a09.README.md) · [独立 QA](island-ground-a09.qa.md)。审核结果以 Claude 的 PR 评论和固定队列为准。

根线程最终同步 Claude 主分支6fdb7eef…后，再次实际执行 `npm run typecheck && npm test`：退出0、68文件/1024项测试全部通过，Vitest06:19:02 UTC开始、42.32秒，完整命令06:18:54开始。此前67基线05:51:07/43.82秒的通过记录保留为历史。未修改测试、引擎、AGENTS 或固定队列任务 / 审核节。

三原稿实际生成05:47:03～05:48:36 UTC，早于6f在06:12:57追加的现成素材优先规则。收到规则后已实际补查ambientCG、Poly Haven、Kenney、OpenGameArt，完整来源/许可线索与通道限制随source-search记录保存。不能把补查写成生成前检索，也不主张没有现成草地；本工作树当前Grass005已实看，它提供无小花的写实草地底材。本PR保留此前已完成的三款带小花绘画候选供Claude审核，没有引入第三方文件或自行替换游戏当前CC0底材。
