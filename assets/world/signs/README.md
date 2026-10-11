# A06 · 猫城霓虹招牌与全息广告

第 1 轮，分支 `codex/3d-world-neon-signs`，base `claude/awesome-babbage-ygba4h` 的 `4b9d0ef3f060f83bd3517560b484c13a37d09606`。本批交付六张 AI 素材，按 [WORLD 工作单](../../../docs/CODEX_WORLD_BRIEF.md) 制作，供 Claude 审核并接入。

| 文件 | 汉字 / 英文 | 尺寸 | 字节数 |
| --- | --- | --- | --- |
| [sign_ramen_horizontal_01.webp](sign_ramen_horizontal_01.webp) | 九命拉面 / RAMEN | 1024×256 | 46,040 |
| [sign_pawn_horizontal_02.webp](sign_pawn_horizontal_02.webp) | 小鱼干当铺 / PAWN | 1024×256 | 59,224 |
| [sign_pharmacy_horizontal_03.webp](sign_pharmacy_horizontal_03.webp) | 猫薄荷药局 / HERBS | 1024×256 | 52,360 |
| [sign_netcafe_vertical_04.webp](sign_netcafe_vertical_04.webp) | 夜猫网咖 / NETCAFE | 256×1024 | 64,512 |
| [sign_bar_vertical_05.webp](sign_bar_vertical_05.webp) | 毛线酒吧 / BAR | 256×1024 | 62,276 |
| [ad_ninelives_hologram_06.webp](ad_ninelives_hologram_06.webp) | 九命有价 / 好梦不赊 / NINE LIVES | 512×1024 | 154,082 |

三张横招牌分别采用猫耳拉面碗、鱼干与钱币、肉垫形薄荷叶图标；两张竖牌采用猫爪与毛线球。广告主体是猫头与胸部、猫爪项圈，文字结合九命设定。底色为黑或深色，霓虹色集中在字、图标与细边框。

## 出处与导出

图像全部由 OpenAI `image_gen.imagegen` 生成，无外部图片参考。当铺在自己的第 1 候选上做两次 AI 文字修正，最终选第 3 候选；其他五张使用第 1 候选。内部候选不增加 Claude 的审核轮次。完整原始提示词、每个原图的文件标识 / 尺寸 / SHA256、编辑所引用的原图 SHA256、候选选择和每张交付图的导出参数见 [出处记录](neon-signs-a06.provenance.json)。

横牌原图为 1983×793，取 1980×495 的完整面板区域，等比降采样为 1024×256。竖牌与广告原图为 1254²；裁掉面板两侧的空白，再补黑色上下留边以满足 1:4 / 1:2 比例，保留框线、主体字形与主要霓虹光晕，最后等比降采样。拉面原图最右 3 列有少量 RGB 最大值 17～31 的淡尾光被裁掉，字、灯管与边框核心完整，成品复核未见断框。所有素材没有上采样、调色、锐化或手工重绘文字。

交付图均为 RGB、不透明、2 的幂尺寸，WebP 质量 90 / method 6，嵌入标准 sRGB ICC profile。原生 RGB 像素按 sRGB 解读。原始生成文件保留在本次工作区 `generated_images`；仓库中的出处记录保留其哈希与完整提示词。

## 审核预览

本批 [六图缩略图](../reviews/neon-signs-a06.webp) 展示各图的原始比例与文案；[自发光样板](../reviews/neon-signs-a06-emissive.webp) 使用独立 Three.js 平面、ClampToEdgeWrapping、sRGB 贴图，比较基础自发光与受控泛光。自发光强度 1.0，bloom 强度 0.18 / 半径 0.15 / 阈值 0.65；详细设置、拍摄命令与六图像素差异见 [预览说明](../reviews/neon-signs-a06.README.md)。样板用于看清素材文字和亮暗层次，游戏接入由 Claude 完成。

六张原图与编码成品经过独立字形、猫元素、尺寸、ICC profile、文件预算及出处哈希复核，详见 [QA 记录](neon-signs-a06.qa.md)。该检查用于送审，Claude 的审核结果另记进度表。

最不满意：全息猫广告的毛发较写实，细毛发和扫描线在小尺寸下比五块图标店招更密，远观主要依靠猫耳轮廓、亮眼睛和大标题识别。接入后需要以实际观看距离评估。
