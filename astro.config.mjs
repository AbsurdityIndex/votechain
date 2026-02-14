// @ts-check
import { defineConfig } from 'astro/config';
import AutoImport from 'astro-auto-import';
import expressiveCode from 'astro-expressive-code';
import lighthouse from 'astro-lighthouse';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import preact from '@astrojs/preact';
import robots from 'astro-robots';
import Icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import rehypeExternalLinks from 'rehype-external-links';

export default defineConfig({
  site: 'https://absurdityindex.org',
  build: {
    assets: 'votechain/_astro',
  },
  devToolbar: {
    enabled: import.meta.env.DEV,
  },
  integrations: [
    AutoImport({
      imports: [],
    }),
    expressiveCode(),
    Icon(),
    lighthouse(),
    mdx(),
    preact(),
    partytown(),
    robots(),
    sitemap(),
  ],
  markdown: {
    rehypePlugins: [[rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
