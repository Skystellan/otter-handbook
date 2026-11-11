import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { callouts } from './src/lib/markdown/callouts.mjs';
import { math } from './src/lib/markdown/math.mjs';

// 本地开发时站点在根路径 `/`；
// GitHub Pages 上站点在子路径 `/otter-handbook/`，由 .github/workflows/deploy.yml 里的 BASE_PATH 传进来。
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://skystellan.github.io',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: {
    processor: satteri({
      features: { math: true, directive: true, headingAttributes: true },
      mdastPlugins: [callouts, math],
    }),
    // 代码高亮：明、暗各一套配色，由 src/styles/prose.css 按当前主题挑一套显示
    shikiConfig: {
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
});
