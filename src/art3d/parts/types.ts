// 3D 部件的统一契约。每种装备 / 武器 / 头饰是一个函数：拿到猫的描述，返回一个挂到对应「插槽」上的 Object3D。
//
// 坐标约定（世界单位：1 ≈ 半个头宽；猫总高约 2.6，脚底 y=0，面朝 +z，+x 是猫的左手边，+y 向上）：
//   headTop  头顶中心（颅骨半径 ≈0.62，头顶在 y=+0.62 处，头饰以它为原点，向上 +y 生长）
//   face     脸正中（鼻子的位置，+z 向前，眼睛在 ±0.27 处）
//   torso    髋部原点（躯干局部坐标，肩在 (±0.52, 1.0, 0)，脖子根在 (0, 1.3, 0)，背在 z=-0.45）
//   handR / handL  掌心原点；武器杆沿 +y（刀尖朝上），刀面朝 +z；握把在原点
//   back     背部中心（原点在 torso 的 (0, 0.95, -0.45)）：披风、旗帜、翅膀、药葫芦
import type * as THREE from 'three';
import type { CatLook, Palette } from '../../art/types';

export interface PartCtx {
  look: CatLook;
  pal: Palette;
  /** 主毛色 / 浅毛色 / 粉色（鼻头耳内） */
  fur: string;
  light: string;
  pink: string;
  /** 阵营字（旗帜用） */
  glyph?: string;
}
export type PartBuilder = (c: PartCtx) => THREE.Object3D;
