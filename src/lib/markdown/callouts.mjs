import { defineMdastPlugin } from 'satteri';

/**
 * 手册里的五种标注块，在 Markdown 里这样写：
 *
 *   :::obs[warmup 太短会怎样]
 *   正文……
 *   :::
 *
 * obs 观察（自己跑出来的） · lit 文献（别人的结论） · recipe 配方（可以直接抄的默认值）
 * pitfall 坑 · open 存疑
 */
export const CALLOUTS = {
  obs: { mark: '◆', zh: '观察', en: 'OBSERVATION' },
  lit: { mark: '◇', zh: '文献', en: 'LITERATURE' },
  recipe: { mark: '▲', zh: '配方', en: 'RECIPE' },
  pitfall: { mark: '✕', zh: '坑', en: 'PITFALL' },
  open: { mark: '?', zh: '存疑', en: 'OPEN QUESTION' },
};

export const callouts = defineMdastPlugin({
  name: 'handbook-callouts',
  containerDirective(node, ctx) {
    const kind = CALLOUTS[node.name];
    if (!kind) return;
    ctx.setProperty(node, 'data', {
      hName: 'aside',
      hProperties: {
        class: `callout callout-${node.name}`,
        'data-mark': kind.mark,
        'data-label': `${kind.zh} ${kind.en}`,
      },
    });
    const first = node.children[0];
    if (first?.data?.directiveLabel) {
      ctx.setProperty(first, 'data', { hName: 'p', hProperties: { class: 'callout-title' } });
    }
  },
});
