# Books

One markdown file per book, exactly like `blog/posts` and `projects/projects`:
English in `en/`, Korean in `ko/`, same filename for both. A slug with both
files gets the language switcher; Korean wins as the default, and the list
marks the entry `EN`.

Drop a file in, and it appears in the pile on `/books`, on the home page, and
at `/books/<slug>`. Nothing else to register.

## Frontmatter

```yaml
---
type: book
title: 'The Pragmatic Programmer' # required
slug: the-pragmatic-programmer # required, must match the filename
author: Hunt & Thomas # printed on the spine (surname only, unless it has a comma or an &)
description: One line, shown under the title and in the pile readout.
date: '2026-04-11' # when you finished it
rating: 4.5 # 0-5, half steps allowed. Omit for no stars.
pages: 352 # drives how thick the spine is in the pile
color: moss # binding cloth, see below. Omit and one is picked from the slug.
cover: '' # front cover artwork, e.g. /images/uploads/books/dune.jpg
spine: '' # spine artwork, same idea
reading: true # still reading it: it sits on top and the readout says so
published: true # required — nothing renders without it
aiTranslated: true # shows the translation notice, same as blog posts
---
```

Everything below the frontmatter is your notes, in normal markdown. Same
pipeline as blog posts, so code blocks, math, images and embeds all work.

## Covers

Put images in `static/images/uploads/books/` and point `cover` (and `spine`,
if you have it) at them.

- `cover` shows on the book's own page, turned to face the reader, and on the
  top board of a pile.
- `spine` replaces the stamped cloth spine in the pile. Without it the spine is
  printed from the title and author, which is usually the better-looking option
  unless you have a clean scan.

A cover wants to be roughly 2:3 and at least 600px wide. Anything is cropped to
fit, so nothing breaks if it is not.

## Cloth colours

`color` takes one of the named cloths — `ink`, `oxblood`, `moss`, `sand`,
`slate`, `rust`, `cream`, `charcoal`, `plum`, `teal`, `navy`, `ochre` — or a
raw `#rrggbb`, in which case the foil colour is picked for contrast. Leave it
out and the cloth is derived from the slug, which stays stable as you add
books.
