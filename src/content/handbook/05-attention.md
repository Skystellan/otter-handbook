---
order: 5
part: model
title: 注意力与序列混合
label: ATTENTION
en: "Attention & sequence mixing"
hint: "mla"
variants: "full  sparse  linear  hybrid"
blurb: token 之间交换信息的地方：从全注意力，到稀疏、线性，再到几种混着用。
status: draft
progress: 0.25
categories:
  - title: 全注意力
    items: ["MHA", "GQA", "MLA", "Gated Attention"]
  - title: 稀疏注意力
    items: ["SWA", "DSA", "LSA", "CSA / HCA"]
  - title: 线性注意力与状态空间
    items: ["Gated DeltaNet", "KDA", "Lightning Attention", "Mamba-2"]
  - title: 混合堆叠
    items: ["KDA : MLA = 3 : 1", "全局层的间隔", "层间配比"]
  - title: 实现
    items: ["Flash Attention", "KV cache"]
---

:::open[这一章目前是排版示例]
下面的内容只用来演示手册里会出现的各种版式：小节、公式、表格、代码和五种标注块。写作时整段替换即可，其余章节都还是空的。
:::

## 全注意力

标准的缩放点积注意力：

$$
\mathrm{Attention}(Q, K, V) = \mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V
$$

其中 $d_k$ 是每个头的维度。几种全注意力的区别，主要在 KV cache 里到底存了什么。

| 方案 | query 头数 | 缓存的内容 | 说明 |
| --- | --- | --- | --- |
| MHA | $h$ | $h$ 组 K / V | 每个头各有一套 |
| GQA | $h$ | $h / g$ 组 K / V | 每 $g$ 个头共享一套 |
| MLA | $h$ | 一份压缩后的潜表示 | 用到时再还原出 K / V |

:::obs[观察块：写你自己跑出来的现象]
建议的四段式：**设置**（模型多大、什么数据、训了多少步）→ **现象**（一句话）→ **证据**（曲线或表格）→ **可能的解释**。
:::

:::lit[文献块：写别人的结论]
先写出处和原文的实验规模，再补一句：这个结论在小模型上你验证过没有。
:::

## 稀疏注意力

行内代码长这样：`F.scaled_dot_product_attention`。代码块：

```python
import torch.nn.functional as F

def attention(q, k, v, causal=True):
    # q, k, v: (batch, heads, seq, head_dim)
    return F.scaled_dot_product_attention(q, k, v, is_causal=causal)
```

:::recipe[配方块：可以直接抄的默认值]
懒得调的时候先用它。每条配方都应该能链接到支撑它的那条观察或那篇文献。
:::

:::pitfall[坑：看起来没问题、实际会出事的写法]
一句话描述症状，再写怎么发现的、怎么修的。
:::

## 线性注意力与状态空间

待写。

## 混合堆叠

待写。
