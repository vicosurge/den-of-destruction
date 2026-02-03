# Den of Destruction

A metal blog originally run from 2011 to 2013, rebuilt as a static site. Covers shows, album reviews, band features, and the underground metal scene.

Originally hosted at [denofdestruction.blogspot.com](https://denofdestruction.blogspot.com).

## Tech Stack

- [Eleventy (11ty)](https://www.11ty.dev/) v3 -- static site generator
- Nunjucks templates
- Vanilla CSS with custom properties
- No JavaScript frameworks

## Getting Started

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build
```

The dev server runs at `http://localhost:8080` with live reload.

The production build outputs to `_site/`.

## Project Structure

```
src/
  _data/           Site-wide data (title, description, nav)
  _includes/       Layouts and template partials
    partials/        Header, footer components
    base.njk         Base HTML layout
    post.njk         Blog post layout
  css/
    style.css        All styles (metal-themed dark design)
  images/            Blog images (add originals here)
  posts/             Blog posts as Markdown files
    posts.json        Default frontmatter for all posts
  index.njk          Homepage
  archive.njk        Archive page (all posts by year)
  about.njk          About page
  tags.njk           Tags index page
  tag-page.njk       Individual tag page template
```

## Adding Blog Posts

Create a Markdown file in `src/posts/` with this frontmatter:

```markdown
---
title: "Post Title"
date: 2012-03-15
tags:
  - shows
  - live reviews
excerpt: "Short description for the homepage card."
image: "/images/photo.jpg"
---

Post content goes here. Standard Markdown.
```

### Frontmatter Fields

| Field     | Required | Description                          |
|-----------|----------|--------------------------------------|
| `title`   | Yes      | Post title                           |
| `date`    | Yes      | Publication date (YYYY-MM-DD)        |
| `tags`    | No       | Array of tags/categories             |
| `excerpt` | No       | Short description for post cards     |
| `image`   | No       | Path to a featured image             |

### Adding Images

1. Place image files in `src/images/`
2. Reference them in posts as `/images/filename.jpg`
3. For featured images, use the `image` frontmatter field
4. Images in post body: `![alt text](/images/filename.jpg)`

## Migrating Content from Blogspot

To bring over posts from the original blog:

1. Open each post on [denofdestruction.blogspot.com](https://denofdestruction.blogspot.com)
2. Create a corresponding `.md` file in `src/posts/` with the date and slug, e.g. `2012-03-15-show-review-title.md`
3. Copy the post content and convert to Markdown
4. Save any images from the blog into `src/images/` and update the image paths
5. Fill in the frontmatter (title, date, tags, excerpt, image)

## Deployment

The built `_site/` folder can be deployed to any static hosting:

- **GitHub Pages** -- push `_site/` or use a GitHub Action
- **Netlify** -- set build command to `npm run build` and publish directory to `_site`
- **Vercel** -- same as Netlify
- **Any web server** -- just serve the `_site/` directory
