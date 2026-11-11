---
order: 1
part: model
title: 分词器
label: TOKENIZER
en: "Tokenizer"
hint: "bpe"
variants: "bpe  unigram  byte"
blurb: 把文本切成 token 的方式，以及词表该开多大。
status: planned
progress: 0
categories:
  - title: 切分算法
    items: ["BPE", "Unigram", "WordPiece", "byte-level"]
  - title: 词表大小
    items: ["参数占比", "序列长度", "覆盖率"]
  - title: 细节处理
    items: ["空白与数字", "特殊 token", "归一化"]
---
