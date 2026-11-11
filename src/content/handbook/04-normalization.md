---
order: 4
part: model
title: 归一化
label: NORM
en: "Normalization"
hint: "rmsnorm"
variants: "rmsnorm  layernorm  dyt"
blurb: 把残差流的尺度稳住的那一层，以及它该放在哪里。
status: planned
progress: 0
categories:
  - title: 归一化类型
    items: ["LayerNorm", "RMSNorm", "DyT"]
  - title: 放置位置
    items: ["pre-norm", "post-norm", "sandwich"]
  - title: 细节
    items: ["QK-norm", "ε", "可学习增益"]
---
