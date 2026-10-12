# A11 瓦面：有限现成来源搜索

本次只读查询于2026-10-12 UTC完成，范围限定六个候选，不生成AI、不认领、不下载素材入库、不改生产/Git/PR。需求是512×512、俯视、横纵可平铺、能读瓦垄的青瓦/金琉璃瓦/朱红瓦。搜索在下面范围停止。

最新source-first规则已实际通过GitHub读取主分支CODEX_QUEUE.md前35行，返回文件blob `15f2c9a6be0d04f7250b479d50e724289387d5c9`。这是**文件blob而非主分支commit**；本机旧6fdb7e的该文件blob为5b9feedf8d1ccf88e0291b03c5610f4c515aa258，不混用为同一快照。读取段中的来源优先/许可/登记CREDITS要求一致。

## 六个候选

| 候选 | 实际目录和许可 | 对A11的关系 | 像素状态与判断边界 |
| --- | --- | --- | --- |
| [ambientCG Roofing Tiles 001](https://ambientcg.com/view?id=RoofingTiles001) | 官方条目已打开；PBR 1K–8K；Slate/Stone；[官方CC0说明](https://docs.ambientcg.com/license/)已读 | 青灰石瓦近似来源；目录是slate，不能据此确认中式曲面瓦垄 | 官方材质thumbnail端点返回图像标记；未收到bitmap，未实看；原始Color/ZIP未下载或解码 |
| [Poly Haven Roof Tiles](https://polyhaven.com/a/roof_tiles) | 官方条目/作者Stephan Seeliger、Diffuse/Normal/Rough等及[CC0许可](https://polyhaven.com/license)已读 | 陶土红瓦的近似候选；目录描述有磨损/污迹，明亮风格与瓦垄形状需实像素判断 | 请求50×50的diffuse预览端点返回图像标记；完整PNG读取失败；未实看完整像素或接缝 |
| [Poly Haven Roof Slates 03](https://polyhaven.com/a/roof_slates_03) | 官方条目/作者Rob Tuytel，1K–8K，灰石板；CC0已读 | 青灰配色近似；石板瓦的形状不能当成已符合曲面青瓦 | 请求50×50的diffuse预览端点返回图像标记；未取得原始Diffuse、未实看 |
| [OpenGameArt Classic Roofing Texture Pack 512px](https://opengameart.org/content/classic-roofing-texture-pack-512px) | Sayarina；条目声明CC0、512²、五包九色；由ambientCG normal/AO构色 | 分辨率最贴近；可优先核包内颜色和瓦形，尚不能确认金/青/朱三款俱全 | 一个[512²透明成员](https://opengameart.org/content/classic-roofing-texture-pack-512px-classicroofing3transparent-1png)许可已核；PNG端点返回图像标记，bitmap未给agent；7z被web工具判unsupported type，压缩包未解码 |
| [OpenGameArt Free Urban Textures: Roof, Tiles](https://opengameart.org/content/free-urban-textures-roof-tiles) | Scouser；条目CC0；roof-tiles.zip链接及约36.8Mb目录信息已读 | 屋顶包的第二个备选；具体形状/配色/分辨率需文件内验证 | 只读到目录/ZIP链接，未访问包内像素，不能判断适配或平铺 |
| [Kenney Isometric Tiles Buildings](https://kenney.nl/assets/isometric-tiles-buildings) | 128文件，2D/Isometric，条目明确CC0，链接[CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/)已读 | **本轮排除**：isometric建筑图块不是俯视独立瓦面贴图 | 目录足以判用途不同；未查看/下载包内像素，不对实际瓦形作视觉评价 |

## 实际访问结果

使用可用web工具完成八个搜索query，并直接读上表官方目录/许可；没有在失败后用curl、换代理、下载媒体等方式绕过。ambientCG目录筛选URL无法读取，另一官方具体条目正常；旧的OGA→ambientCG许可链接404，当前官方license页已读。OGA classicroofing1.7z返回400 unsupported content-type，不等于已成功取得包；Poly Haven完整PNG出现Internal Error，未获得可检查内容。

有四个图像端点被web工具接受：ambientCG官方材质thumbnail、Poly Haven两款各50px的Diffuse map preview、OGA一个512²透明PNG。该MCP实际返回块均为text，仅有ImageDisplayed标记，没有ImageContent/bitmap，也没有本地媒体路径。本agent因此**不能声称视觉实看或逐像素验证**。这些URL可以留作后续正常资产读取的线索，thumbnail/preview不作为已采用的贴图文件。

Poly Haven许可区分CC0原始资产与网站logo/示例渲染等内容；生产应取Diffuse原始文件，不能把预览球渲染当俯视albedo。ambientCG的官方说明明确其download与material preview均在CC0范围，但材质预览依旧不等于要交付的俯视贴图。

## 本轮结论

六条许可都声明CC0，许可门槛已可作下一步依据。可先核Poly Haven陶土红瓦和OGA的512²多色包；青瓦有灰石板近似但曲面瓦垄未证实。金琉璃瓦未取得可验证像素，不能断言各资源库没有合适素材，也不能据目录的“九色”就认定存在金琉璃款。

本轮没有取得完整原图像素/文件哈希，没有512²平铺/接缝测试，没有可直接入库的三款选择。停在这份有限记录；后续取像素、采用/技术缩放、登记CREDITS或改用AI由root根据实际资源访问与造型决定。旧天空/岛草地冻结文件保持未编辑。
