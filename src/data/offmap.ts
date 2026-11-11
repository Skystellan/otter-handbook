/**
 * 「图上不好画的」—— 骨架装不下、但值得先知道的几件事。
 * 显示在首页架构图的下面；每条指向它所在的章节。
 */
export const offmap = [
  {
    chapter: 'attention',
    title: '不同层用不同的注意力',
    text: '图上的 ATTENTION 只有一格，但一个模型里可以混着用：比如每三层线性注意力配一层全注意力。',
  },
  {
    chapter: 'attention',
    title: '先挑，再算',
    text: '稀疏注意力比全注意力多一步：先用一个很轻的索引器挑出少数 key，再只对它们算注意力。',
  },
  {
    chapter: 'ffn',
    title: '路由发生在哪里',
    text: 'MoE 在 FFN 前面加了一个路由器；LatentMoE 把路由和专家都搬到降维之后的潜空间里去做。',
  },
  {
    chapter: 'residual',
    title: '残差流不止一条',
    text: '图上只画了一条竖线。多流的做法把它扩成几条并行的流，层与层之间再加一步混合。',
  },
  {
    chapter: 'residual',
    title: '不只接上一层',
    text: '⊕ 默认只把这一层的输出加回去；也可以让每一层对前面所有层的输出做一次注意力，再汇总。',
  },
  {
    chapter: 'loop',
    title: '同一组层走几圈',
    text: '外框上的「× T」：同一套权重重复使用，推理时可以多走几圈，也可以少走几圈。',
  },
] as const;
