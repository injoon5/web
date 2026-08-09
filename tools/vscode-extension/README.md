# Web Authoring

A VS Code / Cursor extension for writing in this repo's content tree. Plain
JavaScript, no build step, no runtime dependencies — the extension host loads
`src/extension.js` directly.

## Running it

**From source (what you want while working on it):** press <kbd>F5</kbd>, or
Run and Debug → _Run Web Authoring extension_. A second window opens with this
workspace and the extension loaded.

**Installed for daily use:**

```sh
npx @vscode/vsce package        # from tools/vscode-extension
code --install-extension web-authoring-0.1.0.vsix
# Cursor:
cursor --install-extension web-authoring-0.1.0.vsix
```

Tests are `node:test`, no runner to install:

```sh
npm run test:extension          # from the repo root
```

## Drag and drop

Drop an image onto a post and it is filed where that post's media belongs, then
linked:

| Editing                                  | Media lands in                   |
| ---------------------------------------- | -------------------------------- |
| `src/content/blog/{en,ko}/us-camp.md`    | `static/images/uploads/us-camp/` |
| `src/content/projects/{en,ko}/sirius.md` | `static/images/projects/sirius/` |

Both languages of an entry share one folder — they are the same post, so they
are the same pictures. Videos take the same shape under `static/videos/`.

Pasting an image from the clipboard does the same thing, and so does
**Web Authoring: Insert Image or Video…** for when dragging isn't practical.

The whole thing is one undo. The files are created through a workspace edit, so
<kbd>⌘Z</kbd> takes back the link _and_ the copy.

### Names

`IMG_8650.jpeg`, `Screen Shot 2026-08-09 at 14.02.11.png` and a UUID out of
Apple Photos all say nothing, so they become `us-camp-1.jpeg`, numbered after
the entry and skipping whatever is already in the folder. A name someone chose
— `dev-log.png`, `slide-11.png` — is kept and kebab-cased. Set
`webAuthoring.naming` to `original` or `sequence` to force one or the other.

### What gets written

- **One image** → `![alt](/images/uploads/us-camp/us-camp-1.jpeg)`, with `alt`
  as the first tab stop.
- **Several images at once** → one per line with no blank line between them,
  which is exactly what `remark-gallery` reads as a group. Four screenshots
  become a `<Gallery />`; putting a blank line between two of them is the
  escape hatch, same as it is for a human author.
- **A video** → `<LazyVideo src="…" label="…" />`, and the import is spliced
  into the file's instance `<script>` (or one is opened under the frontmatter).
- **A file already under `static/`** → linked where it is. No second copy.

HEIC and TIFF are converted on the way in, because a browser cannot display
them. Everything else is copied byte for byte: `npm run optimize-images`
already compresses from git HEAD at build time, and re-encoding on drop would
only make that job harder. `webAuthoring.transcode: "always"` opts into
downscaling on drop if you want it.

Conversion tries the workspace's own `sharp` in a child process (the extension
host is Electron, whose ABI sharp's prebuilt binaries are not built for), then
`sips` on macOS. If neither is there the file is still copied, with a warning
saying why.

## Autocomplete

| Where                      | You get                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `](` and `src="`           | the current post's own media first, then folder-by-folder completion under `static/`, each with dimensions and file size |
| `](/`                      | cross-links to every entry in the tree — `/projects/sirius`, `/blog/us-camp` — titled                                    |
| frontmatter, empty line    | the fields that kind of entry needs, required ones first, already-present ones dropped                                   |
| `type:`, `published:`      | the values the site actually reads                                                                                       |
| `series:`, `tags:`         | strings a sibling entry already uses, so a series does not split in two over a typo                                      |
| `date:`, `year:`, `slug:`  | today, this year, and the filename                                                                                       |
| `<`                        | `<LazyVideo …/>`, bringing its own import                                                                                |
| `:` at the start of a line | the `:::gallery` fence                                                                                                   |

## Linting

Diagnostics run on the open file. Everything here has a quick fix unless noted.

- **Media that isn't there** — with the nearest existing filename in that folder
  offered as the fix.
- **Empty alt text** — fixable from the filename. It is also the lightbox
  caption, so it is not only an accessibility problem.
- **An unclosed `:::gallery`** — which silently transforms nothing, so the page
  looks fine in review and wrong in production.
- **A smart quote inside `{…}` or the `<script>`** — `js_parse_error` at build
  time. This is the repo's one hard formatting rule, and it is invisible in a
  proportional font.
- **A component used without its import** — mdsvex compiles the file as a Svelte
  component, so `<LazyVideo>` without an import is a build error.
- **Frontmatter gaps** — missing required keys, and a `slug` that disagrees with
  the filename (the route comes from the filename).
- **An entry that exists in one language only** — fix creates the counterpart
  from the same frontmatter, unpublished.
- **Images wider than `webAuthoring.diagnostics.oversizeWidth`** — informational.

## Commands

| Command                                                                                                     | Keybinding     |
| ----------------------------------------------------------------------------------------------------------- | -------------- |
| Open Translation Counterpart — jumps en ⇄ ko, offers to create what's missing                               | <kbd>⌘⌥L</kbd> |
| Wrap Selection in Gallery Fence                                                                             | <kbd>⌘⌥G</kbd> |
| Insert Image or Video…                                                                                      |                |
| New Post or Project… — scaffolds both languages                                                             |                |
| Toggle Published                                                                                            |                |
| Reveal Asset Folder                                                                                         |                |
| Find Unreferenced Assets — scans `images/` and `videos/` against the repo, deletes to trash on confirmation |                |
| Run Image Optimization                                                                                      |                |

The status bar shows the open entry's slug, which languages exist, and whether
it is published. Clicking it opens the counterpart.

## Settings

Everything lives under `webAuthoring.*` — `contentRoot`, `staticRoot`,
`languages`, `assetFolders`, `naming`, `transcode`, `videoComponent` and the
`diagnostics.*` toggles. Defaults describe this repo; the paths are all
configurable, so the extension is not hardcoded to it.

`.vscode/settings.json` in the repo root turns off the built-in markdown
drop/paste handler (it copies media next to the document) and names this
extension's edit kind in `editor.pasteAs.preferences`, so a drop never opens a
picker.
