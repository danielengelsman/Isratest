/**
 * One-time migration script: extracts hardcoded blog posts from
 * blog.html / blog-fr.html / blog-he.html and writes them as
 * Markdown files with YAML frontmatter to content/blog/{lang}/.
 */

import fs from 'fs';
import path from 'path';

// Decode HTML entities (&#1234; and &mdash; etc.)
function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&mdash;/g, '\u2014')
    .replace(/&rarr;/g, '\u2192')
    .replace(/&larr;/g, '\u2190')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euml;/g, 'ë')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&Eacute;/g, 'É')
    .replace(/&ucirc;/g, 'û')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&acirc;/g, 'â')
    .replace(/&icirc;/g, 'î')
    .replace(/&nbsp;/g, ' ');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

// Parse English date "January 23, 2025" → "2025-01-23"
const enMonths = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};
function parseEnDate(dateStr) {
  const parts = dateStr.trim().replace(',', '').split(/\s+/);
  if (parts.length === 3) {
    const month = enMonths[parts[0].toLowerCase()] || '01';
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// Parse French date "23 janvier 2025"
const frMonths = {
  'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
  'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
  'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
};
function parseFrDate(dateStr) {
  const decoded = decodeEntities(dateStr).trim();
  const parts = decoded.split(' ');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = frMonths[parts[1].toLowerCase()] || '01';
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return decoded;
}

// Parse Hebrew date "23 ינואר 2025"
const heMonths = {
  'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04',
  'מאי': '05', 'יוני': '06', 'יולי': '07', 'אוגוסט': '08',
  'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12'
};
function parseHeDate(dateStr) {
  const decoded = decodeEntities(dateStr).trim();
  const parts = decoded.split(' ');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = heMonths[parts[1]] || '01';
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return decoded;
}

function parsePost(block, lang, isFeatured) {
  const catAttr = block.match(/data-cat="([^"]+)"/);
  const cat = catAttr?.[1] || '';

  const imgMatch = block.match(/<img src="([^"]*)" alt="([^"]*)"/);
  const dateMatch = isFeatured
    ? block.match(/<div class="featured-date">([\s\S]*?)<\/div>/)
    : block.match(/<div class="blog-card-date">([\s\S]*?)<\/div>/);
  const titleMatch = isFeatured
    ? block.match(/<h2 class="featured-title"><a href="#">([\s\S]*?)<\/a><\/h2>/)
    : block.match(/<h3 class="blog-card-title"><a href="#">([\s\S]*?)<\/a><\/h3>/);
  const excerptMatch = isFeatured
    ? block.match(/<p class="featured-excerpt">([\s\S]*?)<\/p>/)
    : block.match(/<p class="blog-card-excerpt">([\s\S]*?)<\/p>/);

  const title = decodeEntities(titleMatch?.[1]?.trim() || '');
  let dateStr = decodeEntities(dateMatch?.[1]?.trim() || '');
  let date;
  if (lang === 'en') date = parseEnDate(dateStr);
  else if (lang === 'fr') date = parseFrDate(dateStr);
  else date = parseHeDate(dateStr);

  // For non-English slugs, use the alt text (which is in English-ish or transliterated)
  const slugSource = lang === 'en' ? title : decodeEntities(imgMatch?.[2] || title);

  return {
    title,
    slug: slugify(slugSource),
    date,
    category: cat,
    excerpt: decodeEntities(excerptMatch?.[1]?.trim() || ''),
    image: imgMatch?.[1] || '',
    image_alt: decodeEntities(imgMatch?.[2] || ''),
    featured: isFeatured
  };
}

function extractFeatured(html, lang) {
  // Extract the featured-post block (from opening tag to the blog-grid)
  const m = html.match(/<div class="featured-post reveal"[\s\S]*?<\/div>\s*<\/div>\s*\n\s*\n\s*<!-- Blog Grid -->/);
  if (!m) return null;
  return parsePost(m[0], lang, true);
}

function extractCards(html, lang) {
  // Extract the entire blog-grid section
  const gridMatch = html.match(/<!-- Blog Grid -->\s*<div class="blog-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/);
  if (!gridMatch) return [];

  const gridHtml = gridMatch[1];

  // Split by <!-- Post N --> comments to isolate each card
  const cardBlocks = gridHtml.split(/<!-- Post \d+ -->/).filter(b => b.includes('blog-card'));

  return cardBlocks.map(block => parsePost(block, lang, false));
}

function toMarkdown(post) {
  // Escape quotes in title/excerpt for YAML
  const escTitle = post.title.replace(/"/g, '\\"');
  const escExcerpt = post.excerpt.replace(/"/g, '\\"');
  const escAlt = post.image_alt.replace(/"/g, '\\"');

  return `---
title: "${escTitle}"
slug: "${post.slug}"
date: ${post.date}
category: "${post.category}"
excerpt: "${escExcerpt}"
image: "${post.image}"
image_alt: "${escAlt}"
featured: ${post.featured}
---

${post.title}
`;
}

const files = {
  en: 'blog.html',
  fr: 'blog-fr.html',
  he: 'blog-he.html'
};

const root = process.cwd();
let totalFiles = 0;

// Extract English posts first to get canonical slugs
const enHtml = fs.readFileSync(path.join(root, files.en), 'utf8');
const enFeatured = extractFeatured(enHtml, 'en');
const enCards = extractCards(enHtml, 'en');
const enSlugs = [enFeatured.slug, ...enCards.map(c => c.slug)];

for (const [lang, file] of Object.entries(files)) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const featured = extractFeatured(html, lang);
  const cards = extractCards(html, lang);

  const outDir = path.join(root, 'content', 'blog', lang);

  // Use English slugs for all languages (posts are in same order)
  if (featured) {
    featured.slug = enSlugs[0];
    const fp = path.join(outDir, `${featured.slug}.md`);
    fs.writeFileSync(fp, toMarkdown(featured), 'utf8');
    console.log(`  [${lang}] featured: ${featured.slug}.md`);
    totalFiles++;
  }

  for (let i = 0; i < cards.length; i++) {
    cards[i].slug = enSlugs[i + 1] || cards[i].slug;
    const fp = path.join(outDir, `${cards[i].slug}.md`);
    fs.writeFileSync(fp, toMarkdown(cards[i]), 'utf8');
    console.log(`  [${lang}] card: ${cards[i].slug}.md`);
    totalFiles++;
  }

  console.log(`\n  ${lang}: ${featured ? 1 : 0} featured + ${cards.length} cards\n`);
}

console.log(`\nMigration complete: ${totalFiles} Markdown files created.`);
