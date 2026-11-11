import { defineMdastPlugin } from 'satteri';
import katex from 'katex';

const render = (tex, displayMode) =>
  katex.renderToString(tex, { displayMode, throwOnError: false, strict: 'ignore' });

/** `$...$` 与 `$$...$$` → KaTeX（构建期渲染，页面不带 JS）。 */
export const math = defineMdastPlugin({
  name: 'handbook-math',
  math(node) {
    return { type: 'html', value: `<div class="math-block">${render(node.value, true)}</div>` };
  },
  inlineMath(node) {
    return { type: 'html', value: render(node.value, false) };
  },
});
