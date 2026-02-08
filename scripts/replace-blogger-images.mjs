#!/usr/bin/env node

/**
 * Replace Blogger image URLs with local paths in blog posts.
 *
 * Usage:
 *   node scripts/replace-blogger-images.mjs           # apply changes
 *   node scripts/replace-blogger-images.mjs --dry-run  # preview only
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

const IMAGES_DIR = 'src/images';
const POSTS_DIR = 'src/posts';
const DRY_RUN = process.argv.includes('--dry-run');

// Step 1: Build reverse mapping from Blogger filename -> local filename
async function buildImageMap() {
  const map = new Map(); // bloggerFilename -> localFilename
  const files = await readdir(IMAGES_DIR);

  for (const f of files) {
    // Skip non-JSON, skip metadata.json, skip (1)/(2) duplicate variants
    if (!f.endsWith('.json')) continue;
    if (f === 'metadata.json') continue;
    if (/\(\d+\)\.json$/.test(f)) continue;

    const jsonPath = join(IMAGES_DIR, f);
    const data = JSON.parse(await readFile(jsonPath, 'utf8'));
    const bloggerName = data.filename;
    const localName = f.replace(/\.json$/, ''); // e.g. "foo.jpg.json" -> "foo.jpg"

    if (bloggerName) {
      map.set(bloggerName, localName);
    }

    // Also add direct-match entry for the local filename itself
    // (handles cases where Blogger URL uses the same name as local)
    if (!map.has(localName)) {
      map.set(localName, localName);
    }
  }

  // Also add all image files directly (non-JSON) as direct matches
  for (const f of files) {
    if (f.endsWith('.json')) continue;
    if (!map.has(f)) {
      map.set(f, f);
    }
  }

  return map;
}

// Extract the filename from a Blogger URL
// URLs look like: https://blogger.googleusercontent.com/img/b/R29vZ2xl/.../s{size}/{FILENAME}
// or: https://blogger.googleusercontent.com/img/b/R29vZ2xl/.../s72-c/{FILENAME}
function extractBloggerFilename(url) {
  const match = url.match(/\/s\d+(?:-c)?\/(.+)$/);
  if (!match) return null;
  return match[1];
}

// Decode a Blogger filename to match local files
// Blogger URLs encode spaces as +, and may double-encode special chars
function decodeBloggerFilename(filename) {
  // Replace + with space
  let decoded = filename.replace(/\+/g, ' ');
  // Replace "hyphenhyphen" with "--" (Blogger escapes double hyphens)
  decoded = decoded.replace(/hyphenhyphen/g, '--');
  // Try double URL decode
  try {
    decoded = decodeURIComponent(decodeURIComponent(decoded));
  } catch {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // leave as-is
    }
  }
  return decoded;
}

// Look up a Blogger filename in our map, trying various decode strategies
function lookupLocal(imageMap, bloggerFilename) {
  // Try raw first
  if (imageMap.has(bloggerFilename)) return imageMap.get(bloggerFilename);

  // Try decoded
  const decoded = decodeBloggerFilename(bloggerFilename);
  if (imageMap.has(decoded)) return imageMap.get(decoded);

  // Try with + as space (no other decoding)
  const plusDecoded = bloggerFilename.replace(/\+/g, ' ');
  if (imageMap.has(plusDecoded)) return imageMap.get(plusDecoded);

  return null;
}

// Step 2: Process posts
async function processPost(filePath, imageMap) {
  const content = await readFile(filePath, 'utf8');
  let modified = content;
  const replacements = [];
  const unmapped = [];

  // Replace inline images: ![Image]({https://blogger.googleusercontent.com/.../s{size}/{FILENAME}})
  modified = modified.replace(
    /!\[Image\]\(\{(https:\/\/blogger\.googleusercontent\.com\/[^}]+)\}\)/g,
    (match, url) => {
      const bloggerFilename = extractBloggerFilename(url);
      if (!bloggerFilename) {
        unmapped.push(url);
        return match;
      }
      const localName = lookupLocal(imageMap, bloggerFilename);
      if (localName) {
        replacements.push({ type: 'inline', from: bloggerFilename, to: localName });
        return `![Image](/images/${localName})`;
      } else {
        unmapped.push(bloggerFilename);
        return match;
      }
    }
  );

  // Replace thumbnail frontmatter
  modified = modified.replace(
    /^(thumbnail:\s*")(https:\/\/blogger\.googleusercontent\.com\/[^"]+)(")/m,
    (match, prefix, url, suffix) => {
      const bloggerFilename = extractBloggerFilename(url);
      if (!bloggerFilename) {
        unmapped.push(url);
        return match;
      }
      const localName = lookupLocal(imageMap, bloggerFilename);
      if (localName) {
        replacements.push({ type: 'thumbnail', from: bloggerFilename, to: localName });
        return `${prefix}/images/${localName}${suffix}`;
      } else {
        unmapped.push(bloggerFilename);
        return match;
      }
    }
  );

  return { modified, replacements, unmapped, changed: modified !== content };
}

// Main
async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLYING CHANGES ===');
  console.log();

  const imageMap = await buildImageMap();
  console.log(`Built image map: ${imageMap.size} entries`);
  console.log();

  const postFiles = (await readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  let totalReplacements = 0;
  let totalInline = 0;
  let totalThumbnails = 0;
  let filesModified = 0;
  const allUnmapped = [];

  for (const pf of postFiles) {
    const filePath = join(POSTS_DIR, pf);
    const { modified, replacements, unmapped, changed } = await processPost(filePath, imageMap);

    if (changed) {
      filesModified++;
      const inlineCount = replacements.filter(r => r.type === 'inline').length;
      const thumbCount = replacements.filter(r => r.type === 'thumbnail').length;
      totalInline += inlineCount;
      totalThumbnails += thumbCount;
      totalReplacements += replacements.length;

      console.log(`${pf}: ${inlineCount} inline, ${thumbCount} thumbnail`);
      for (const r of replacements) {
        console.log(`  ${r.type}: ${r.from} -> ${r.to}`);
      }

      if (!DRY_RUN) {
        await writeFile(filePath, modified, 'utf8');
      }
    }

    for (const u of unmapped) {
      allUnmapped.push({ file: pf, image: u });
    }
  }

  console.log();
  console.log('=== SUMMARY ===');
  console.log(`Files modified: ${filesModified}`);
  console.log(`Total replacements: ${totalReplacements} (${totalInline} inline, ${totalThumbnails} thumbnails)`);

  if (allUnmapped.length > 0) {
    console.log();
    console.log(`Unmapped images (${allUnmapped.length}):`);
    for (const u of allUnmapped) {
      console.log(`  ${u.file}: ${u.image}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
