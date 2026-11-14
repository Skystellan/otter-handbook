import { getCollection, render, type CollectionEntry } from 'astro:content';
import { parts, type PartKey } from '../site.config';

export type Chapter = CollectionEntry<'handbook'>;

export interface OutlineItem {
  title: string;
  items: string[];
  /** 正文里对应小节的锚点（分类来自 frontmatter 时没有） */
  anchor?: string;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 全部章节，按 order 排序。 */
export async function getChapters(): Promise<Chapter[]> {
  const all = await getCollection('handbook');
  return all.sort((a, b) => a.data.order - b.data.order);
}

/** 按「部分」分组，顺序与 site.config.ts 里的 parts 一致。 */
export function groupByPart(chapters: Chapter[]) {
  return (Object.keys(parts) as PartKey[]).map((key) => ({
    key,
    ...parts[key],
    chapters: chapters.filter((c) => c.data.part === key),
  }));
}

/**
 * 一个章节的「分类」——悬浮卡片和章节页开头都用它。
 * frontmatter 里写了 categories 就用它；没写就读正文的 h2（分类）和 h3（条目）。
 */
export async function getOutline(chapter: Chapter): Promise<OutlineItem[]> {
  const { headings } = await render(chapter);
  if (chapter.data.categories.length) {
    return chapter.data.categories.map((c) => ({
      ...c,
      anchor: headings.find((h) => h.depth === 2 && h.text.trim() === c.title)?.slug,
    }));
  }
  const outline: OutlineItem[] = [];
  for (const h of headings) {
    if (h.depth === 2) outline.push({ title: h.text, items: [], anchor: h.slug });
    else if (h.depth === 3) outline[outline.length - 1]?.items.push(h.text);
  }
  return outline;
}

/** ▓▓▓░░░░░ */
export function progressBar(progress: number, width = 8) {
  const filled = Math.round(Math.min(1, Math.max(0, progress)) * width);
  return { on: '▓'.repeat(filled), off: '░'.repeat(width - filled) };
}

export const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

/** 草稿笔记（frontmatter 里 draft: true）只在本地 npm run dev 里显示，构建上线时排除。 */
export const isVisibleNote = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;
