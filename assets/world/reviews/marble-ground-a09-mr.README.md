# A09-MR · 汉白玉审图

审图读取三张最终1024² RGB WebP，仅做常规缩放 / 排列 / 直接重复，没有矿纹画线、补接缝、模糊融合或调色。全部图嵌sRGB ICC、2的幂尺寸、单文件≤500,000 B。

[总览](marble-ground-a09-mr.webp)：2048×1024、RGB WebP quality85 / method6，77,558 B。三列为淡奶白细晶 / 柔浅金矿纹 / 暖象牙云脉；上方512²单图，下方256²的2×2 / 4×4缩略，不是生成联系表。

## 直接平铺

| ID | 2×2（1024²） | 4×4（1024²） |
| --- | --- | --- |
| `ground_palace_marble_milk_01` | [87,848 B](ground_palace_marble_milk_01-2x2.webp) | [78,512 B](ground_palace_marble_milk_01-4x4.webp) |
| `ground_palace_marble_gold_02` | [35,494 B](ground_palace_marble_gold_02-2x2.webp) | [35,456 B](ground_palace_marble_gold_02-4x4.webp) |
| `ground_palace_marble_cloud_03` | [53,694 B](ground_palace_marble_cloud_03-2x2.webp) | [61,708 B](ground_palace_marble_cloud_03-4x4.webp) |

2×2单元由最终图等比Lanczos缩512²，4×4单元缩256²，再直接重复。quality85 / method6 WebP有损再编码，用于观察视觉周期；精确像素值看源图与无损PNG。

## 1:1 全边与四角

坐标零起点 / 半开区间。LR128×1024为成品右64列（x960…1024）接左64列（x0…64），覆盖全高度。TB1024×128为底64行（y960…1024）接顶64行（y0…64），覆盖全宽度。四角256²把各128²裁片按BR / BL / TR / TL放在左上 / 右上 / 左下 / 右下。

PNG没有空间缩放或有损压缩；RGB数组与最终解码裁片逐字节一致，不声称源边界像素相同。

| 材料 | 左右全边 | 上下全边 | 四角 |
| --- | --- | --- | --- |
| 奶白细晶 | [LR](ground_palace_marble_milk_01-native-lr.png) | [TB](ground_palace_marble_milk_01-native-tb.png) | [交会](ground_palace_marble_milk_01-native-corners.png) |
| 浅金细枝 | [LR](ground_palace_marble_gold_02-native-lr.png) | [TB](ground_palace_marble_gold_02-native-tb.png) | [交会](ground_palace_marble_gold_02-native-corners.png) |
| 象牙云脉 | [LR](ground_palace_marble_cloud_03-native-lr.png) | [TB](ground_palace_marble_cloud_03-native-tb.png) | [交会](ground_palace_marble_cloud_03-native-corners.png) |

自查范围：2×2 / 4×4与1:1四边 / 四角未见粗暗框或强跳色；浅金端点与柔云边缘仍有相位差，4×4可见低频周期。边界并非逐像素相等，这些图不构成数学无缝证明。

另附 [真实GPU白光 / 午后金光样板](marble-ground-a09-mr-lighting.webp) 与 [固定参数](marble-ground-a09-mr-lighting.README.md)。完整生成 / 导出 / 成品与审图SHA见 [出处](../ground/marble-ground-a09-mr.provenance.json)。
