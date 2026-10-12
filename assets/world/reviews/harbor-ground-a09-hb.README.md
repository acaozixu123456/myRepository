# A09-HB · 港口旧木审图

审图读取三张最终 1024² RGB WebP，只有常规缩放 / 排列和直接重复，没有木纹画线、补接缝、模糊融合或调色。全部图嵌 sRGB ICC、2的幂尺寸、单文件≤500,000 B。

[总览](harbor-ground-a09-hb.webp)：2048×1024、RGB WebP quality85 / method6，140,204 B。三列对应暖旧褐宽板 / 浅漂洗板 / 浅褐窄板；上方512²单图，下方256²的2×2 / 4×4缩略，不是生成联系表。

## 直接平铺

| ID | 2×2（1024²） | 4×4（1024²） |
| --- | --- | --- |
| `ground_harbor_oldwood_01` | [134,814 B](ground_harbor_oldwood_01-2x2.webp) | [108,740 B](ground_harbor_oldwood_01-4x4.webp) |
| `ground_harbor_washed_02` | [127,104 B](ground_harbor_washed_02-2x2.webp) | [85,712 B](ground_harbor_washed_02-4x4.webp) |
| `ground_harbor_narrowwood_03` | [143,162 B](ground_harbor_narrowwood_03-2x2.webp) | [105,510 B](ground_harbor_narrowwood_03-4x4.webp) |

2×2单元由最终源图等比Lanczos缩512²，4×4单元缩256²，然后直接重复。质量85 / method6 WebP审图有损再编码，仅用于视觉周期检查，精确像素值看最终源图与无损PNG。

## 1:1 全边与四角

坐标零起点 / 半开区间。LR128×1024是成品右64列（x960…1024）接左64列（x0…64），覆盖全高度。TB1024×128是底64行（y960…1024）接顶64行（y0…64），覆盖全宽度。四角256²将各128²裁片按 BR / BL / TR / TL 放在左上 / 右上 / 左下 / 右下。

PNG没有空间缩放或有损压缩；RGB数组与最终解码裁片逐字节一致，不声称源边界像素相同。

| 材料 | 左右全边 | 上下全边 | 四角 |
| --- | --- | --- | --- |
| 暖旧褐宽板 | [LR](ground_harbor_oldwood_01-native-lr.png) | [TB](ground_harbor_oldwood_01-native-tb.png) | [交会](ground_harbor_oldwood_01-native-corners.png) |
| 浅漂洗木板 | [LR](ground_harbor_washed_02-native-lr.png) | [TB](ground_harbor_washed_02-native-tb.png) | [交会](ground_harbor_washed_02-native-corners.png) |
| 浅褐窄板 | [LR](ground_harbor_narrowwood_03-native-lr.png) | [TB](ground_harbor_narrowwood_03-native-tb.png) | [交会](ground_harbor_narrowwood_03-native-corners.png) |

自查范围：2×2 / 4×4与1:1全边 / 四角未见额外粗横断、边框或大块暗污；有规则平行板缝、板色 / 纤维周期以及少许板宽差。木纹上下不是逐像素相等，不能当数学无缝证明。

另附 [真实GPU白光 / 晚霞样板](harbor-ground-a09-hb-lighting.webp) 与 [固定参数](harbor-ground-a09-hb-lighting.README.md)。全部生成 / 导出 / 成品与审图SHA见 [出处](../ground/harbor-ground-a09-hb.provenance.json)。

