/**
 * 站点级配置。名字、口号、仓库地址都只在这里改一次。
 */
export const site = {
  /** 项目名（暂定）。页头、标题、页脚大字都读这里 */
  name: 'otter',
  /** 中文副标题 */
  nameZh: '小模型训练手册',
  version: 'v0.1',
  tagline: '自己踩过的坑，别人走通的路。',
  taglineEn: 'Field notes on training small models.',
  description:
    '一本开源手册：记录训练小模型时的第一手观察，并汇总文献里可复用的经验。按模型结构组织，从分词器一路到量化部署。',
  repo: 'https://github.com/Skystellan/otter-handbook',
  author: 'Skystellan',
  /** 文字内容 CC BY 4.0（见 LICENSE-CONTENT），代码 MIT（见 LICENSE） */
  license: '文字 CC BY 4.0 · 代码 MIT',
  nav: [
    { href: '/handbook/', label: '手册', en: 'handbook' },
    { href: '/notes/', label: '观察', en: 'notes' },
    { href: '/papers/', label: '文献', en: 'papers' },
    { href: '/about/', label: '关于', en: 'about' },
  ],
} as const;

/** 手册的三个部分，决定目录分组与架构图上的分区 */
export const parts = {
  model: { no: 'I', en: 'MODEL', zh: '模型结构', lead: '信息从 token 到 logits 一路经过的东西。' },
  training: { no: 'II', en: 'TRAINING', zh: '训练过程', lead: '让损失往下走的那一圈回路。' },
  after: { no: 'III', en: 'AFTER', zh: '训练之后', lead: '评测、压缩，然后真的跑起来。' },
} as const;

export type PartKey = keyof typeof parts;

export const statusLabel = {
  planned: '未动笔',
  draft: '草稿',
  review: '待校对',
  stable: '已成稿',
} as const;

export const kinds = {
  obs: { mark: '◆', zh: '观察', en: 'OBS', desc: '我自己跑出来的现象，尽量附上配置、曲线和可复现的脚本。' },
  lit: { mark: '◇', zh: '文献', en: 'LIT', desc: '别人工作里的结论，标明出处，以及它在小模型上是否依然成立。' },
  recipe: { mark: '▲', zh: '配方', en: 'RECIPE', desc: '在小模型上值得直接抄的默认值，懒得调参时先用它。' },
  pitfall: { mark: '✕', zh: '坑', en: 'PITFALL', desc: '踩过的坑：看起来合理、实际上会悄悄把训练搞坏的做法。' },
  open: { mark: '?', zh: '存疑', en: 'OPEN', desc: '还没想明白，或者几篇文献结论互相矛盾的地方。' },
} as const;

export type KindKey = keyof typeof kinds;
