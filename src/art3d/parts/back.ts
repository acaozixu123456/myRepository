// 披挂：挂在 back（torso 内 (0, 0.95, -0.45)，向后为 -z）。
import type { PartBuilder } from './types';
import { capeLong, ribbons, wings } from './back-sp-regalia';
import { cape, furCloak, gourd } from './back-fieldgear';
import { banner, scrollBack } from './back-scroll-banner';

export const BACK: Record<string, PartBuilder> = {
  cape,
  capeLong,
  banner,
  wings,
  scrollBack,
  gourd,
  furCloak,
  ribbons,
};
