#!/usr/bin/env node

/**
 * Script to fetch prompts from Supabase and update README.md
 *
 * Usage: node scripts/update-readme.mjs
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tsawdbxjjbcdoiqohjyj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const WEBSITE_URL = 'https://bestnanobananaprompt.com';
const MAX_ITEMS = 50; // Maximum items to show in README

if (!SUPABASE_KEY) {
  console.error('Error: SUPABASE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchPrompts() {
  console.log('Fetching prompts from database...');

  const { data, error } = await supabase
    .from('content_items')
    .select('*')
    .eq('status', 'approved')
    .eq('type', 'image')
    .order('likes_count', { ascending: false })
    .limit(MAX_ITEMS);

  if (error) {
    console.error('Error fetching data:', error);
    throw error;
  }

  console.log(`Fetched ${data.length} prompts`);
  return data;
}

function truncatePrompt(prompt, maxLength = 100) {
  if (prompt.length <= maxLength) return prompt;
  return prompt.substring(0, maxLength) + '...';
}

function escapeMarkdown(text) {
  return text
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

function generateGalleryTable(items) {
  let table = '| Preview | Prompt | Style | Link |\n';
  table += '|---------|--------|-------|------|\n';

  for (const item of items) {
    const imageUrl = item.image_url || '';
    const prompt = escapeMarkdown(truncatePrompt(item.prompt || '', 80));
    const style = item.style || '-';
    const detailLink = `${WEBSITE_URL}/gallery?id=${item.id}`;

    // Use a small preview image
    const preview = imageUrl
      ? `<img src="${imageUrl}" width="100" alt="${escapeMarkdown(item.name || 'Prompt')}">`
      : '-';

    table += `| ${preview} | ${prompt} | ${style} | [View](${detailLink}) |\n`;
  }

  return table;
}

function generatePromptsList(items) {
  let content = '';

  // Group by style
  const byStyle = {};
  for (const item of items) {
    const style = item.style || 'Other';
    if (!byStyle[style]) byStyle[style] = [];
    byStyle[style].push(item);
  }

  for (const [style, styleItems] of Object.entries(byStyle)) {
    content += `\n### ${style}\n\n`;

    for (const item of styleItems.slice(0, 10)) {
      const detailLink = `${WEBSITE_URL}/gallery?id=${item.id}`;
      content += `#### ${escapeMarkdown(item.name || 'Untitled')}\n\n`;

      if (item.image_url) {
        content += `<img src="${item.image_url}" width="400" alt="${escapeMarkdown(item.name || 'Preview')}">\n\n`;
      }

      content += `**Prompt:**\n\`\`\`\n${item.prompt || ''}\n\`\`\`\n\n`;
      content += `**[View on Website](${detailLink})** | `;
      content += `Likes: ${item.likes_count || 0}\n\n`;
      content += `---\n\n`;
    }
  }

  return content;
}

async function updateReadme(items) {
  const readmePath = path.join(__dirname, '..', 'README.md');
  let readme = fs.readFileSync(readmePath, 'utf-8');

  // Generate new gallery content
  const galleryContent = generatePromptsList(items);

  // Replace content between markers
  const startMarker = '<!-- GALLERY_START -->';
  const endMarker = '<!-- GALLERY_END -->';

  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    readme = readme.substring(0, startIndex + startMarker.length) +
      '\n' + galleryContent + '\n' +
      readme.substring(endIndex);
  }

  fs.writeFileSync(readmePath, readme);
  console.log('README.md updated successfully!');
}

async function main() {
  try {
    const items = await fetchPrompts();
    await updateReadme(items);
    console.log('Done!');
  } catch (error) {
    console.error('Failed to update README:', error);
    process.exit(1);
  }
}

main();
