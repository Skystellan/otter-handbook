import { defineMdastPlugin } from 'satteri';

/**
 * 单独成段的图片排成一个图块（<figure>），按正文宽度居中显示。
 * 图片的 title 会变成图注：
 *
 *   ![warmup 太短时的 loss 曲线](./img/warmup-loss.png "图注写在引号里")
 *
 * 带图注的图块会自动编号（FIG. 01、02 …），样式见 src/styles/prose.css。
 */
export const figures = defineMdastPlugin({
  name: 'handbook-figures',
  paragraph(node, ctx) {
    const kids = node.children.filter((c) => !(c.type === 'text' && !c.value.trim()));
    if (kids.length !== 1 || kids[0].type !== 'image') return;
    const img = kids[0];
    ctx.setProperty(node, 'data', { hName: 'figure' });
    if (img.title) {
      ctx.appendChild(node, {
        type: 'paragraph',
        data: { hName: 'figcaption' },
        children: [{ type: 'text', value: img.title }],
      });
      ctx.setProperty(img, 'title', null);
    }
  },
});
