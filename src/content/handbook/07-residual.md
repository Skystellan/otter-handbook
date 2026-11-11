---
order: 7
part: model
title: 残差连接
label: RESIDUAL
en: "Residual connections"
hint: "mhc"
variants: "add  mhc  attnres  gr"
blurb: 子层的输出怎样写回残差流：一条流直接相加，还是多条流、带混合、带门控。
status: planned
progress: 0
categories:
  - title: 单流残差
    items: ["pre-norm", "LayerScale", "ReZero"]
  - title: 多流与混合
    items: ["HC", "mHC", "双随机约束"]
  - title: 深度聚合
    items: ["AttnRes", "Block AttnRes", "多头 / 多流变体"]
  - title: 门控
    items: ["GR", "MGR"]
---
