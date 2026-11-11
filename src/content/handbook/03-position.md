---
order: 3
part: model
title: 位置编码
label: POSITION
en: "Positional encoding"
hint: "rope"
variants: "rope  alibi  learned  none"
blurb: 模型怎样知道 token 的先后顺序。
status: planned
progress: 0
categories:
  - title: 绝对位置
    items: ["sinusoidal", "learned"]
  - title: 旋转与相对位置
    items: ["RoPE", "partial RoPE", "ALiBi"]
  - title: 不显式编码
    items: ["NoPE"]
  - title: 长度外推
    items: ["训练外长度", "频率基数"]
---
