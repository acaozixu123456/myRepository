# A09-FR · 草地落叶审图

审图读取三张最终1024² RGB WebP，只做常规缩放 / 排列 / 直接重复，没有草叶画线、修缝、模糊融合或调色。全部图嵌sRGB ICC、2的幂尺寸、单文件≤500,000 B。

[总览](forest-ground-a09-fr.webp)：2048×1024 RGB WebP quality85 / method6，356,302 B。三列依次青绿稀叶 / 苔绿暖叶 / 浅鲜小叶；上方512²单图，下方256²的2×2 / 4×4缩略，素材来自各自独立生成，不是联系表裁切。

## 直接平铺

| ID | 2×2（1024²） | 4×4（1024²） |
| --- | --- | --- |
| `ground_forest_grass_sparse_01` | [407,090 B](ground_forest_grass_sparse_01-2x2.webp) | [350,042 B](ground_forest_grass_sparse_01-4x4.webp) |
| `ground_forest_moss_leaves_02` | [343,602 B](ground_forest_moss_leaves_02-2x2.webp) | [306,442 B](ground_forest_moss_leaves_02-4x4.webp) |
| `ground_forest_grass_light_03` | [303,772 B](ground_forest_grass_light_03-2x2.webp) | [251,106 B](ground_forest_grass_light_03-4x4.webp) |

2×2单元为最终图Lanczos缩512²，4×4单元缩256²，再直接重复。quality85 / method6 WebP有损再编码，用于观察周期；精确像素值看成品与无损PNG。

## 1:1全边与四角

坐标零起点 / 半开区间。LR128×1024为成品右64列（x960…1024）接左64列（x0…64），覆盖全高度。TB1024×128为底64行（y960…1024）接顶64行（y0…64），覆盖全宽度。四角256²把各128²裁片按BR / BL / TR / TL放在左上 / 右上 / 左下 / 右下。

PNG无空间缩放和有损压缩；RGB数组与最终解码裁片逐字节一致，不声称源边界像素相同。

| 材料 | 左右全边 | 上下全边 | 四角 |
| --- | --- | --- | --- |
| 青绿稀叶 | [LR](ground_forest_grass_sparse_01-native-lr.png) | [TB](ground_forest_grass_sparse_01-native-tb.png) | [交会](ground_forest_grass_sparse_01-native-corners.png) |
| 苔绿暖叶 | [LR](ground_forest_moss_leaves_02-native-lr.png) | [TB](ground_forest_moss_leaves_02-native-tb.png) | [交会](ground_forest_moss_leaves_02-native-corners.png) |
| 浅鲜小叶 | [LR](ground_forest_grass_light_03-native-lr.png) | [TB](ground_forest_grass_light_03-native-tb.png) | [交会](ground_forest_grass_light_03-native-corners.png) |

自查范围：2×2 / 4×4与1:1边角没有额外粗暗框或强跳色，保留叶片端点 / 草丝相位差；叶位和草簇低频重复可辨，尤其简化草地的小斑块。边界非逐像素相等，不当数学无缝证明。

另附 [实际GPU白光 / 清晨样板](forest-ground-a09-fr-lighting.webp) 与 [固定参数](forest-ground-a09-fr-lighting.README.md)。完整AI生成 / 编辑 / 原图与成品SHA见 [出处](../ground/forest-ground-a09-fr.provenance.json)。
