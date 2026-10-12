// ℹ️ 说明按钮：把长段说明收进弹窗，页面上只留一个小按钮。弹窗由 app/main.ts 的 data-act="info" 打开。
import { esc } from './components';

/** text 里用 \n 换行；title 可选（弹窗标题） */
export function infoBtn(text: string, title = ''): string {
  return `<button class="infob" data-act="info" data-t="${esc(text)}" data-h="${esc(title)}" aria-label="说明">ℹ️</button>`;
}
export function infoDialogHtml(text: string, title = ''): string {
  const body = esc(text).split('\n').map((l) => `<p>${l}</p>`).join('');
  return `<div class="mask center" data-act="closedialog"><div class="dialog info-dlg">${title ? `<h3 class="title" style="margin:0 0 6px">${esc(title)}</h3>` : ''}${body}<div style="text-align:center;margin-top:10px"><button class="btn" data-act="closedialog">知道了</button></div></div></div>`;
}
export const INFO_CSS = `.infob{display:inline-grid;place-items:center;width:22px;height:22px;margin-left:6px;padding:0;border:0;border-radius:50%;background:rgba(255,255,255,.55);font-size:13px;line-height:1;vertical-align:middle;cursor:pointer;box-shadow:0 1px 0 rgba(0,0,0,.18)}
.info-dlg p{font-size:13.5px;font-weight:700;line-height:1.7;margin:0 0 6px;text-align:left}`;
