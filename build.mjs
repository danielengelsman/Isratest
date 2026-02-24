/**
 * Build script: reads Markdown blog posts from content/blog/{lang}/
 * and generates blog.html, blog-fr.html, blog-he.html by sandwiching
 * generated HTML between top/bottom templates.
 *
 * Usage: node build.mjs
 * Dependencies: gray-matter
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

// ── Language configurations ──

const langs = {
  en: {
    folder: 'content/blog/en',
    output: 'blog.html',
    topTemplate: 'templates/blog-en-top.html',
    bottomTemplate: 'templates/blog-en-bottom.html',
    categoryLabels: {
      'real-estate': 'Israel Real Estate',
      'economy': 'The Shekel Exchange',
      'team': 'The Team',
      'podcasts': 'Podcasts'
    },
    readMore: 'Read More',
    listenNow: 'Listen Now',
    readFull: 'Read Full Article',
    arrow: '&rarr;',
    locale: 'en-US',
    dateOptions: { month: 'long', day: 'numeric', year: 'numeric' }
  },
  fr: {
    folder: 'content/blog/fr',
    output: 'blog-fr.html',
    topTemplate: 'templates/blog-fr-top.html',
    bottomTemplate: 'templates/blog-fr-bottom.html',
    categoryLabels: {
      'real-estate': 'Immobilier en Isra&euml;l',
      'economy': 'Le Change du Shekel',
      'team': "L'&Eacute;quipe",
      'podcasts': 'Podcasts'
    },
    readMore: 'Lire la Suite',
    listenNow: '&Eacute;couter',
    readFull: "Lire l'Article Complet",
    arrow: '&rarr;',
    locale: 'fr-FR',
    dateOptions: { day: 'numeric', month: 'long', year: 'numeric' }
  },
  he: {
    folder: 'content/blog/he',
    output: 'blog-he.html',
    topTemplate: 'templates/blog-he-top.html',
    bottomTemplate: 'templates/blog-he-bottom.html',
    categoryLabels: {
      'real-estate': '&#1504;&#1491;&#1500;&quot;&#1503; &#1489;&#1497;&#1513;&#1512;&#1488;&#1500;',
      'economy': '&#1513;&#1506;&#1512; &#1492;&#1513;&#1511;&#1500;',
      'team': '&#1492;&#1510;&#1493;&#1493;&#1514;',
      'podcasts': '&#1508;&#1493;&#1491;&#1511;&#1488;&#1505;&#1496;&#1497;&#1501;'
    },
    readMore: '&#1511;&#1512;&#1488;&#1493; &#1506;&#1493;&#1491;',
    listenNow: '&#1492;&#1488;&#1494;&#1497;&#1504;&#1493; &#1506;&#1499;&#1513;&#1497;&#1493;',
    readFull: '&#1511;&#1512;&#1488;&#1493; &#1488;&#1514; &#1492;&#1502;&#1488;&#1502;&#1512; &#1492;&#1502;&#1500;&#1488;',
    arrow: '&larr;',
    locale: 'he-IL',
    dateOptions: { day: 'numeric', month: 'long', year: 'numeric' }
  }
};

// ── Helpers ──

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateVal, locale, options) {
  // gray-matter may parse dates as Date objects or strings
  let date;
  if (dateVal instanceof Date) {
    date = dateVal;
  } else {
    const [y, m, d] = String(dateVal).split('-').map(Number);
    date = new Date(Date.UTC(y, m - 1, d));
  }
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
}

// Image color palette for blog cards (cycle through these)
const cardColors = ['0D2847', '1a3a5c', '1a4a6e', '1a3550', '1a2844', '1a3048'];
const featuredColor = '1a2e4a';

// ── HTML generators ──

function generateFeaturedPost(post, lang) {
  const cfg = langs[lang];
  const catLabel = cfg.categoryLabels[post.category] || post.category;
  const date = formatDate(post.date, cfg.locale, cfg.dateOptions);
  const imgSrc = post.image || `https://placehold.co/800x500/${featuredColor}/${featuredColor}`;
  const imgAlt = escapeHtml(post.image_alt || post.title);
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);

  const linkText = post.category === 'podcasts'
    ? cfg.listenNow
    : cfg.readFull;

  // Hebrew: body first, image second (for RTL)
  // EN/FR: image first, body second
  const imgBlock = `      <div class="featured-img">
        <img src="${imgSrc}" alt="${imgAlt}"/>
        <div class="featured-img-overlay"></div>
      </div>`;

  const bodyBlock = `      <div class="featured-body">
        <div class="featured-cat">${catLabel}</div>
        <div class="featured-date">${date}</div>
        <h2 class="featured-title"><a href="#">${title}</a></h2>
        <p class="featured-excerpt">${excerpt}</p>
        <a href="#" class="featured-link">${lang === 'he' ? cfg.arrow + ' ' + linkText : linkText + ' ' + cfg.arrow}</a>
      </div>`;

  const inner = lang === 'he'
    ? bodyBlock + '\n' + imgBlock
    : imgBlock + '\n' + bodyBlock;

  return `    <!-- Featured Post -->
    <div class="featured-post reveal" data-cat="${post.category}">
${inner}
    </div>`;
}

function generateBlogCard(post, index, lang) {
  const cfg = langs[lang];
  const catLabel = cfg.categoryLabels[post.category] || post.category;
  const date = formatDate(post.date, cfg.locale, cfg.dateOptions);
  const rdClass = `rd${(index % 6) + 1}`;
  const colorIdx = index % cardColors.length;
  const color = cardColors[colorIdx];
  const imgSrc = post.image || `https://placehold.co/600x400/${color}/${color}`;
  const imgAlt = escapeHtml(post.image_alt || post.title);
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt);

  const linkText = post.category === 'podcasts'
    ? cfg.listenNow
    : cfg.readMore;

  return `      <!-- Post ${index + 1} -->
      <div class="blog-card reveal ${rdClass}" data-cat="${post.category}">
        <div class="blog-card-img">
          <img src="${imgSrc}" alt="${imgAlt}"/>
          <div class="blog-card-img-overlay"></div>
          <div class="blog-card-img-color"></div>
          <span class="blog-card-cat">${catLabel}</span>
        </div>
        <div class="blog-card-body">
          <div class="blog-card-date">${date}</div>
          <h3 class="blog-card-title"><a href="#">${title}</a></h3>
          <p class="blog-card-excerpt">${excerpt}</p>
          <a href="#" class="blog-card-link">${lang === 'he' ? cfg.arrow + ' ' + linkText : linkText + ' ' + cfg.arrow}</a>
        </div>
      </div>`;
}

// ── Main build ──

const root = process.cwd();

for (const [lang, cfg] of Object.entries(langs)) {
  const contentDir = path.join(root, cfg.folder);

  // Read all .md files
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));
  const posts = files.map(f => {
    const raw = fs.readFileSync(path.join(contentDir, f), 'utf8');
    const { data } = matter(raw);
    return data;
  });

  // Sort by date descending
  posts.sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    return db - da;
  });

  // Find featured post
  let featuredIdx = posts.findIndex(p => p.featured === true);
  if (featuredIdx === -1) featuredIdx = 0; // fallback: newest
  const featured = posts[featuredIdx];
  const cards = posts.filter((_, i) => i !== featuredIdx);

  // Generate HTML
  const featuredHtml = generateFeaturedPost(featured, lang);

  const cardsHtml = cards
    .map((post, i) => generateBlogCard(post, i, lang))
    .join('\n\n');

  const gridHtml = `
    <!-- Blog Grid -->
    <div class="blog-grid">

${cardsHtml}

    </div>
  </div>
</section>

`;

  // Read templates
  const top = fs.readFileSync(path.join(root, cfg.topTemplate), 'utf8');
  const bottom = fs.readFileSync(path.join(root, cfg.bottomTemplate), 'utf8');

  // Assemble
  const output = top + featuredHtml + '\n' + gridHtml + bottom;

  fs.writeFileSync(path.join(root, cfg.output), output, 'utf8');
  console.log(`Built ${cfg.output}: ${featured.title} (featured) + ${cards.length} cards`);
}

console.log('\nBuild complete.');
