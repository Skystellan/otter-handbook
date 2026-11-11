import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** `05-attention.md` → id `attention`：文件名带序号方便排序，URL 里不带。 */
const stripOrder = ({ entry }: { entry: string }) =>
  entry.replace(/\.md$/, '').replace(/^\d+-/, '');

/**
 * 手册章节 —— 每个文件对应架构图上的一个组件。
 * 悬浮卡片里的「分类」来自这里的 `categories`；
 * 如果不写，会退回去读正文里的二级 / 三级标题。
 */
const handbook = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/handbook', generateId: stripOrder }),
  schema: z.object({
    order: z.number().int(),
    part: z.enum(['model', 'training', 'after']),
    /** 中文标题 */
    title: z.string(),
    /** 画在图上的标签：纯 ASCII 大写，尽量短 */
    label: z.string().regex(/^[A-Z0-9 \-]+$/),
    /** 英文全名 */
    en: z.string(),
    blurb: z.string(),
    /** 窄版架构图框里的小字：「现在的默认选择」 */
    hint: z.string().optional(),
    /** 宽版架构图框右边的小字：这个位置有哪几类做法。纯 ASCII，用两个空格隔开，不超过 28 个字符 */
    variants: z.string().regex(/^[\x20-\x7e]+$/).max(28).optional(),
    status: z.enum(['planned', 'draft', 'review', 'stable']).default('planned'),
    progress: z.number().min(0).max(1).default(0),
    updated: z.coerce.date().optional(),
    categories: z
      .array(z.object({ title: z.string(), items: z.array(z.string()).default([]) }))
      .default([]),
  }),
});

/** 观察 / 笔记 —— 按时间排的流水账，可以挂到一个或多个章节上。 */
const notes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    kind: z.enum(['obs', 'lit', 'recipe', 'pitfall', 'open']).default('obs'),
    /** 关联的章节 id，例如 [attention, schedule] */
    components: z.array(z.string()).default([]),
    summary: z.string().optional(),
    /** 示例条目会在页面上标出来，方便之后删掉 */
    sample: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

/** 文献 —— 一个 YAML 文件，一条一篇。 */
const papers = defineCollection({
  loader: file('./src/data/papers.yaml'),
  schema: z.object({
    title: z.string(),
    authors: z.string(),
    year: z.number().int(),
    venue: z.string().optional(),
    url: z.url().optional(),
    components: z.array(z.string()).default([]),
    /** 一句话：这篇对训练小模型意味着什么 */
    takeaway: z.string().optional(),
  }),
});

export const collections = { handbook, notes, papers };
