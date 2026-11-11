# otter · 小模型训练手册

自己踩过的坑，别人走通的路。一本记录训练小模型经验的开源手册：第一手观察，加上文献里可复用的结论，按模型结构从分词器一路组织到量化部署。

在线阅读：<https://skystellan.github.io/otter-handbook/>

## 跑起来

需要 Node.js 22.22 或更新版本。

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # 输出到 dist/，纯静态
```

推送到 `main` 之后，`.github/workflows/deploy.yml` 会自动构建并发布到 GitHub Pages，一两分钟后生效。

## 怎么写

| 写什么 | 放在哪 | 说明 |
| --- | --- | --- |
| 手册章节 | `src/content/handbook/NN-*.md` | 在第二个 `---` 下面写正文；同时把 `status` 改成 `draft` / `review` / `stable`，并更新 `progress`（0–1） |
| 观察 / 笔记 | `src/content/notes/*.md` | 新建文件；`kind` 选 `obs` `lit` `recipe` `pitfall` `open` 之一，`components` 填相关章节 id |
| 文献 | `src/data/papers.yaml` | 一条一篇，`components` 填章节 id，会自动挂到对应章节下 |

章节 id 就是去掉序号的文件名：`tokenizer` `embedding` `position` `normalization` `attention` `ffn` `residual` `loop` `head` `data` `objective` `optimizer` `schedule` `regularization` `initialization` `evaluation` `distillation` `quantization` `inference`。

正文里可以用五种标注块：

```markdown
:::obs[标题写成一个可以被推翻的句子]
设置 → 现象 → 证据 → 可能的解释
:::
```

把 `obs` 换成 `lit`（文献）、`recipe`（配方）、`pitfall`（坑）、`open`（存疑）即可。现有的三条笔记和 `attention` 一章是排版示例（笔记标了 `sample: true`），写了真内容之后删掉。

## 许可

文字内容（`src/content/`、`src/data/`）采用 [CC BY 4.0](LICENSE-CONTENT)，代码采用 [MIT](LICENSE)。

## 设计

整个站当成一张「印样」来做：纸、墨，外加一块克莱因蓝的专色版。

- **封面是一段着色器。** 一只仰面漂着的海獭，抱着一块克莱因蓝的石头 —— 不是图片，是 `src/lib/otter/` 里用距离场捏出来、每一帧现算的：
  先捏出「皮」，皮外面套一层薄壳，壳里是毛 —— 视线穿过这层壳的时候一小步一小步地问「这里有没有一根毛」，
  所以毛是一根一根的，毛根暗、毛梢亮，轮廓是绒的；眼睛周围和嘴上的毛剪得很短。头上的毛是干的、蓬的，身上的是湿的、一绺一绺的。
  造型是照着海獭捏的：又宽又扁的头（不是球）、一整块往前鼓的口鼻、又宽又黑的鼻子、长在头两侧的小耳朵、
  没有脖子的长身子、扇形的脚蹼和一片扁尾巴；头和朝天的胸口、肚子是浅色的，两侧和四肢是深的。
  它抬着头看自己肚子上的石头，镜头在它斜上方。
  算出来的「照片」再分成黑、蓝两块版，各自套一层转了角度的网点（黑 45°、蓝 15°）印到纸面上。
  它有一副简单的骨架：头从脖子根上转，带一点惯性，胡须比头慢半拍；前肢两节骨头长度固定；
  石头是刚体，掂的时候真的离手、翻一圈、再落回爪子里。它会看着你的指针；点一下水面会起涟漪；点它，它会掂两下石头。
- **四种印法。** 封面底下那排按钮：网点、字符、有序抖动，或者不印、直接看原片。`/lab/` 是只有它的试片台（地址后面加 `?mode=photo&zoom=3&x=0.3&y=1.3` 可以凑近了看某一处）。
- **地图。** `src/components/Atlas.astro`：一张 SVG 架构图，token 沿主干往上流，梯度沿虚线绕回去；
  每个框是一章，指针移上去，右边的面板显示那一章的分类、进度，和一张会动的小图（`src/lib/figs.ts`，十九张）。
- **目录。** 指针划过某一行，旁边会跟着那一章的小图；点进去，标题是从目录那一行「长」到章节页上的（跨页面的视图过渡）。
- **章节页。** 左边是标出当前位置的小地图，中间是正文，右边是跟着滚动高亮的本页目录。
- 明暗两套主题；窄屏有单独的排法；系统设了「减少动态效果」的时候，动画都停在一帧上。

## 目录

```text
src/
├── lib/otter/shaders.ts    两段着色器：「照相机」（光线步进 + 毛层）和「印刷机」（分色 + 网点 + 胡须）
├── lib/otter/renderer.ts   WebGL2：骨架与动作、镜头、指针、涟漪、明暗主题、暂停与降级
├── lib/figs.ts             十九张会动的小图
├── components/Hero.astro   封面
├── components/Atlas.astro  架构图 + 检视面板
├── components/ChapterList.astro  目录
├── styles/                 base（设计系统）· hero · atlas · home · inner · prose
└── pages/                  首页 / 手册 / 观察 / 文献 / 关于 / 404 / lab
```

没有 WebGL2 的浏览器只会少封面那张画，文字都在。
