---
order: 6
part: model
title: 前馈与专家
label: FFN
en: "Feed-forward & mixture of experts"
hint: "moe"
variants: "dense  moe  latent-moe"
blurb: 每个位置各自做的非线性变换：一个稠密 FFN，或者一组只激活几个的专家。
status: planned
progress: 0
categories:
  - title: 稠密 FFN
    items: ["GELU", "SwiGLU", "扩张倍数"]
  - title: MoE
    items: ["router", "top-k", "负载均衡", "shared expert"]
  - title: LatentMoE
    items: ["潜空间路由", "d / ℓ 压缩", "更多专家"]
  - title: 小模型上的取舍
    items: ["专家数 vs. 宽度", "激活参数量"]
---
