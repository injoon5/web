#!/usr/bin/env python3
"""Rebuild the site's Interlude web fonts. Run by hand; commit what it writes.

    python3 -m venv .venv-fonts
    .venv-fonts/bin/pip install -r scripts/fonts/requirements.txt
    .venv-fonts/bin/python scripts/fonts/build-interlude.py

It is not part of `npm run build` on purpose: the output is checked in, so a
deploy never runs a font tool, and a change in fontTools can never change the
site's type without a commit that says so.

What it writes
--------------
- `static/fonts/interlude/interlude-core.<hash>.woff2` — ASCII, the punctuation
  most pages use (nbsp © · – — ‘ ’ “ ”), the arrows the site uses, and the
  Latin-1 / Latin Extended-A letters that shared an upstream file with that
  punctuation (see "Why the layout tables are cut by old file"). Preloaded.
- `static/fonts/interlude/interlude-extended.<hash>.woff2` — every other
  Interlude character in Latin-1, the covered part of Latin Extended-A, and the
  site's own source (… × ° − ⚠ …). Behind `unicode-range`, so it only downloads
  on a page that draws one of its characters.
- `static/fonts/interlude/hangul/NN.<hash>.woff2` — Hangul from interlude-ui
  1.3 (see "Hangul" below): first the syllables the site's own text uses,
  declared in app.css, then every other syllable in frequency tiers, declared
  in the subset sheet.
- The `@font-face` rules, between the markers in `src/app.css`.
- `static/fonts/interlude/interlude-variable-dynamic-subset.css` — the long
  tail: upstream's own subset files, untouched, with each `unicode-range` cut
  down to the characters that file still draws (CJK, kana, compatibility jamo, rarer symbols).
- The preload `href` between the markers in `src/app.html`.
- `src/lib/fonts/interlude.json` — the manifest `interlude.test.js` checks the
  site's source against.

Rendering is meant to be *identical* to the shipped 1.2.1 dynamic subset, and
verification (on unless `--no-verify`) proves it with HarfBuzz before anything is written:
every outline and advance at a grid of weights and optical sizes, and the
shaping of every ordered pair of the two files' characters, against the files
those characters came from. Read "Why the layout tables are cut by old file"
below before changing the character sets.

When to rerun
-------------
- `npm test` fails in `interlude.test.js` — the site's source now uses an
  Interlude character the two files do not carry. (It still renders correctly
  from the long tail; rerunning just moves it into the extended file.)
- A stylesheet sets `font-stretch`, a `wdth` variation or
  `font-feature-settings`, or turns on an OpenType feature through
  `font-variant-*` other than tabular figures — the two files have no width
  axis and carry only the features in FEATURES. (`interlude.test.js` checks
  the stylesheets for these too.)
- Interlude is upgraded (UPSTREAM_VERSION / HANGUL_VERSION).
- Optional: after publishing Korean text with syllables the site has not used
  before. They render either way, from a frequency tier; rerunning folds them
  into the site's own chunks, which listing pages prefetch.
"""

from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import io
import itertools
import json
import re
import subprocess
import sys
import tarfile
import urllib.request
from collections import defaultdict
from pathlib import Path

from fontTools import subset
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables import otBase, otTables
from fontTools.ttLib.woff2 import WOFF2FlavorData
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / '.cache' / 'fonts'
FONT_DIR = ROOT / 'static' / 'fonts' / 'interlude'
TAIL_DIR = FONT_DIR / 'woff2-dynamic-subset'
TAIL_CSS = FONT_DIR / 'interlude-variable-dynamic-subset.css'
APP_CSS = ROOT / 'src' / 'app.css'
APP_HTML = ROOT / 'src' / 'app.html'
MANIFEST = ROOT / 'src' / 'lib' / 'fonts' / 'interlude.json'
URL_PREFIX = '/fonts/interlude'

UPSTREAM_VERSION = '1.2.1'
UPSTREAM_INTEGRITY = (
	'sha512-YOeyCkw1SO284rDY0Oeq7lt7SRnrZSt/yXGUNk7+TpV6XHe7QqoP1ePqiQGN1MVlD9Nmhxmyz+zsIcyiOyHPkg=='
)

# Hangul comes from a later release: 1.3 rebalanced all 11,172 syllables
# against the Latin at every weight. Measured, its vertical strokes run 0.97–1.01
# of Inter's `l` at 400–600 where 1.2.1's run 0.90–0.94, and a paragraph's ink
# lands within 6% of Latin's at every weight the site uses. Same UPM, vertical
# metrics, advances and outlines' extents as 1.2.1 — only the stroke weight moved
# — so it sits beside the 1.2.1 Latin without moving a line.
HANGUL_VERSION = '1.3.0'
HANGUL_INTEGRITY = (
	'sha512-1oj2w1XbiBiHszctPOvLCdwnAQ30/S9R9E0qwcc8dhf522gJxMa413Ox54gyxF21eAORuzOpG+jTRXE3ANIZug=='
)
HANGUL_DIR = FONT_DIR / 'hangul'
HANGUL_FREQUENCY = Path(__file__).with_name('hangul-frequency.txt')
HANGUL_SYLLABLES = range(0xAC00, 0xD7A4)
HANGUL_COMPAT_JAMO = range(0x3131, 0x318F)
# Rendered on every page: the header's Korean name.
HANGUL_CHROME_SOURCES = ['src/routes/+layout.svelte', 'src/lib/nav']
# Never drawn with the web font: OG images use their own .woff files, JSON-LD
# is not rendered.
HANGUL_IGNORED_SOURCES = ['src/lib/og', 'src/lib/seo']
HANGUL_CHUNK = 100

FAMILY = 'Interlude Variable'

# Every face of the family carries the *same* descriptors as upstream's. CSS
# font matching picks one set of descriptors per family before unicode-range is
# consulted, so a core face declaring `300 900` beside tail faces declaring
# `100 900` would be a different face: characters only the tail draws would
# fall through to the system font instead of to the tail.
DESCRIPTORS = (
	"\tfont-style: normal;\n\tfont-display: swap;\n\tfont-weight: 100 900;\n\tfont-stretch: 75% 125%;\n"
)

# Axes. Width is pinned at 100: nothing sets `font-stretch` or a `wdth`
# variation. Optical size stays whole — `font-optical-sizing` is `auto`, so it
# follows font-size, and the site sets type from 9.8px to 112px.
#
# Weight stays whole too, though the stylesheets only reach 300 (layerchart's
# axis labels on /health) to 900 (`h1 strong` in prose, and `bolder` on
# semibold text). Cutting it to 300–900 would save 1.7KB on the core, but no
# master sits outside that range, so every delta has to be re-derived — and
# that re-rounds every point of every glyph. A 400–700 cut saves 13KB and would
# change the 300, 800 and 900 text outright.

# Features browsers apply on their own (HarfBuzz's horizontal defaults, which
# Chrome, Firefox and Safari's WebKit shaping path all use), plus `tnum` for
# `tabular-nums`. Nothing on the site sets `font-feature-settings`.
FEATURES = [
	'abvm', 'blwm', 'calt', 'ccmp', 'clig', 'curs', 'dist', 'kern', 'liga', 'locl',
	'mark', 'mkmk', 'rclt', 'rlig', 'rvrn',
	'tnum',
]

ASCII = list(range(0x20, 0x7F))

# On the core's own merits: measured on the crawled pages (44), © and · are in
# every footer, nbsp on 32, — on 24, ’ on 19, “” on 17. Cheap glyphs that keep
# most pages from ever touching the extended file.
#
# Not … (U+2026), though it is on 13 pages. When the primary font has no …,
# Chrome builds the `line-clamp` / `text-overflow: ellipsis` ellipsis out of
# three of its periods, and upstream's base file never had one. A core with …
# draws every truncated title with Interlude's ellipsis glyph instead — a
# different shape, caught by the pixel diff. In the extended file, a page that
# writes … pays 3KB, and truncation stays `...`.
CORE_PUNCTUATION = [0xA0, 0xA9, 0xB7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D]

# Arrows shared upstream's base file with ASCII, and they kern and take case
# forms against capitals and figures — so the ones the site uses ride in the
# core with ASCII, or `→A` would set differently than it does today. The other
# 25 base arrows cost 5KB on every page for nothing; they stay in the tail.
CORE_ARROWS = [0x2190, 0x2192, 0x21A9]

LATIN_1 = range(0xA0, 0x100)
LATIN_EXT_A = range(0x100, 0x180)

# Upstream's subset CSS was declared twice: once from the dynamic sheet, and its
# base face again from app.css, after it. The later rule is consulted first, so
# that is the order the legacy map is built in.
LEGACY_BASE_DECLARED_LAST = True

# Verification grid: every weight the CSS uses, at both ends and the middle of
# the optical-size axis.
VERIFY_WGHT = [300, 400, 450, 500, 600, 700, 800, 900]
VERIFY_OPSZ = [14, 16, 20, 24, 32]
VERIFY_SHAPE_INSTANCES = [(300, 14), (400, 14), (450, 16), (500, 20), (600, 24), (700, 32), (900, 32)]


def log(*a):
	print(*a, file=sys.stderr)


# --------------------------------------------------------------------------
# Upstream


def fetch_upstream(version=UPSTREAM_VERSION, integrity=UPSTREAM_INTEGRITY) -> dict[str, bytes]:
	CACHE.mkdir(parents=True, exist_ok=True)
	tgz = CACHE / f'interlude-ui-{version}.tgz'
	if not tgz.exists():
		url = f'https://registry.npmjs.org/interlude-ui/-/interlude-ui-{version}.tgz'
		log(f'fetching {url}')
		with urllib.request.urlopen(url) as r:
			tgz.write_bytes(r.read())
	data = tgz.read_bytes()
	algo, want = integrity.split('-', 1)
	got = base64.b64encode(hashlib.new(algo, data).digest()).decode()
	if got != want:
		tgz.unlink()
		sys.exit(f'{tgz.name}: integrity mismatch (got {algo}-{got})')
	files = {}
	with tarfile.open(fileobj=io.BytesIO(data)) as t:
		for m in t.getmembers():
			if m.isfile() and (
				m.name.endswith('dist/woff2/InterludeVariable.woff2') or '/dist/dynamic-subset/' in m.name
			):
				key = m.name.split('/dist/', 1)[1]
				# Upstream ships `base` beside the woff2/ directory the others are in.
				if key.endswith('.woff2') and 'subset.' in key:
					key = 'dynamic-subset/woff2/' + key.rsplit('/', 1)[1]
				files[key] = t.extractfile(m).read()
	return files


def parse_ranges(text: str) -> set[int]:
	out = set()
	for part in text.replace('\n', ' ').split(','):
		part = part.strip()
		if not part:
			continue
		part = part[2:]
		if '-' in part:
			a, b = part.split('-')
			out.update(range(int(a, 16), int(b, 16) + 1))
		else:
			out.add(int(part, 16))
	return out


def format_ranges(cps) -> str:
	cps = sorted(cps)
	runs, start, prev = [], None, None
	for c in cps:
		if start is None:
			start = prev = c
		elif c == prev + 1:
			prev = c
		else:
			runs.append((start, prev))
			start = prev = c
	if start is not None:
		runs.append((start, prev))
	return ', '.join(f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}' for a, b in runs)


def legacy_faces(files):
	"""Upstream's subset faces in declaration order, with each face's cmap, and
	the face that drew each codepoint in the shipped 1.2.1 setup."""
	css = files['dynamic-subset/interlude-variable-dynamic-subset.css'].decode()
	faces = []
	for name, ranges in re.findall(r'subset\.(\w+)\.woff2.*?unicode-range:([^;]*);', css, re.S):
		data = files[f'dynamic-subset/woff2/InterludeVariable.subset.{name}.woff2']
		faces.append((name, parse_ranges(ranges), set(TTFont(io.BytesIO(data)).getBestCmap() or {})))
	order = list(faces)
	if LEGACY_BASE_DECLARED_LAST:
		order.append(next(f for f in faces if f[0] == 'base'))
	drawn_by = {}
	# A codepoint inside a face's range but missing from its cmap falls through
	# to the next face, so the effective face is the latest-declared one that
	# both claims and has it.
	for name, ranges, cmap in reversed(order):
		for cp in ranges & cmap:
			drawn_by.setdefault(cp, name)
	return faces, drawn_by


# --------------------------------------------------------------------------
# What the site uses


def strip_comments(text: str, suffix: str) -> str:
	if suffix in ('.js', '.svelte', '.css'):
		text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
		text = re.sub(r'(?m)^\s*//.*$', '', text)
	if suffix in ('.svelte', '.html', '.md'):
		text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
	return text


def site_characters() -> dict[int, list[str]]:
	used = defaultdict(list)
	src = ROOT / 'src'
	for path in sorted(src.rglob('*')):
		if path.suffix not in ('.md', '.svelte', '.js', '.css', '.html') or not path.is_file():
			continue
		rel = path.relative_to(ROOT).as_posix()
		if '.test.' in path.name or rel.startswith('src/test/'):
			continue
		for ch in set(strip_comments(path.read_text('utf8'), path.suffix)):
			if ord(ch) > 0x7E:
				used[ord(ch)].append(rel)
	return used


def is_hangul(cp):
	return 0xAC00 <= cp <= 0xD7A3 or 0x1100 <= cp <= 0x11FF or 0x3130 <= cp <= 0x318F or 0xA960 <= cp <= 0xA97F or 0xD7B0 <= cp <= 0xD7FF


def is_cjk(cp):
	return (
		is_hangul(cp)
		or 0x2E80 <= cp <= 0x2FFF
		or 0x3000 <= cp <= 0x9FFF
		or 0xF900 <= cp <= 0xFAFF
		or 0xFE30 <= cp <= 0xFE4F
		or 0xFF00 <= cp <= 0xFFEF
		or cp >= 0x1F200
	)


# --------------------------------------------------------------------------
# Building


def subset_font(full: bytes, cps) -> TTFont:
	font = TTFont(io.BytesIO(full), lazy=True)
	opt = subset.Options()
	opt.layout_features = FEATURES
	opt.glyph_names = False
	opt.notdef_outline = False
	opt.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
	opt.name_languages = [0x409]
	# There is no hinting to drop: no fpgm, no cvt, no instructions in any glyph.
	# What is there is a 13-byte `prep` (dropout control) and `gasp`, which
	# DirectWrite reads to choose its smoothing — so they stay.
	opt.hinting = True
	# MVAR is in the full font but in none of upstream's subset files, so it
	# has never reached a browser: it varies the underline and x-height metrics
	# by weight, which would move `text-underline-offset: auto` links.
	# STAT is for font menus; BASE (1.3 only) for baselines nothing here reads.
	opt.drop_tables += ['MVAR', 'STAT', 'BASE']
	s = subset.Subsetter(opt)
	s.populate(unicodes=cps)
	s.subset(font)
	pin_width(font)
	# Named instances and their names are for font menus.
	font['fvar'].instances = []
	keep = {a.axisNameID for a in font['fvar'].axes} | set(range(256))
	font['name'].names = [n for n in font['name'].names if n.nameID in keep]
	return font


def match_rasterizer(font: TTFont, latin: bytes) -> TTFont:
	"""Hand the Hangul the Latin's rasterizer settings, so the two set alike.

	Windows rasterizes each file through DirectWrite, which chooses grid-fitting
	and smoothing from the file's own `gasp` and runs its own `prep`. The 1.2.1
	Latin carries a `prep` (dropout control) that 1.3 dropped, so a Korean word
	and the English beside it went through two different programs. Outlines are
	untouched; CoreText and FreeType's light hinting never read either table.
	"""
	ref = TTFont(io.BytesIO(latin), lazy=True)
	for tag in ('prep', 'gasp'):
		font[tag] = copy.deepcopy(ref[tag])
	for field in (
		'maxZones', 'maxTwilightPoints', 'maxStorage', 'maxFunctionDefs',
		'maxInstructionDefs', 'maxStackElements', 'maxSizeOfInstructions',
	):
		setattr(font['maxp'], field, getattr(ref['maxp'], field))
	font['head'].lowestRecPPEM = ref['head'].lowestRecPPEM
	return font


def pin_width(font: TTFont):
	"""Drop the wdth axis at its default without moving a single point.

	At wdth=100 every tuple that peaks on wdth contributes exactly nothing, so
	the right instance is the font with those tuples deleted and every other
	delta left alone. fontTools' instancer gets there by first filling in the
	deltas IUP would infer and rounding them to integers — but renderers infer
	them in floating point, so that moved points by up to half a unit (36 of the
	95 ASCII glyphs). So the instancer does everything except gvar, and gvar is
	done here.
	"""
	gvar = font['gvar'].variations
	kept = {}
	for glyph, tvs in gvar.items():
		kept[glyph] = []
		for tv in tvs:
			if tv.axes.get('wdth', (0, 0, 0))[1] != 0:
				continue
			# A copy: the instancer rewrites the originals in place.
			tv = copy.deepcopy(tv)
			tv.axes.pop('wdth', None)
			kept[glyph].append(tv)
	font = instancer.instantiateVariableFont(font, {'wdth': 100}, optimize=False, inplace=True)
	font['gvar'].variations = kept


# --------------------------------------------------------------------------
# Why the layout tables are cut by old file
#
# A browser shapes each run of text with one font file. Upstream split Latin
# across many files — ASCII in `base`, “ ” – — · in `117`, ’ ‘ in `58`, … in
# `112`, © in `115` — so in the shipped site `T’s` was three runs and the T
# never kerned against the ’. Put them in one file and HarfBuzz kerns them: 2167
# of the 54k character pairs set differently. So inside each new file, every
# pair, contextual and ligature rule is restricted to glyphs that came from the
# same old file. Each file then behaves exactly like the set of old files it
# replaces, and `--verify` checks every pair.


def glyph_groups(font: TTFont, group_of_cp) -> dict[str, set[str]]:
	groups = defaultdict(set)
	for cp, g in font.getBestCmap().items():
		groups[g].add(group_of_cp(cp))
	if 'GSUB' not in font:
		return groups
	lookups = font['GSUB'].table.LookupList.Lookup
	changed = True
	while changed:
		changed = False
		for lookup in lookups:
			for st in lookup.SubTable:
				if lookup.LookupType == 7:
					st = st.ExtSubTable
				pairs = []
				t = st.LookupType if hasattr(st, 'LookupType') else lookup.LookupType
				if t == 1:
					pairs = [([a], [b]) for a, b in st.mapping.items()]
				elif t == 2:
					pairs = [([a], b) for a, b in st.mapping.items()]
				elif t == 3:
					pairs = [([a], b) for a, b in st.alternates.items()]
				elif t == 4:
					for first, ligs in st.ligatures.items():
						for lig in ligs:
							pairs.append(([first] + list(lig.Component), [lig.LigGlyph]))
				elif t == 8:
					pairs = [([a], [b]) for a, b in zip(st.Coverage.glyphs, st.Substitute)]
				for ins, outs in pairs:
					sets = [groups.get(g, set()) for g in ins]
					if not all(sets):
						continue
					common = set.intersection(*sets)
					if not common:
						continue
					for o in outs:
						if not common <= groups[o]:
							groups[o] |= common
							changed = True
	return groups


def isolate_layout(font: TTFont, groups: dict[str, set[str]]):
	"""Restrict every multi-glyph rule to glyphs of a single old file."""
	groups = {g: s for g, s in groups.items() if s}
	multi = {g: s for g, s in groups.items() if len(s) > 1}
	if multi:
		raise SystemExit(f'glyphs reachable from more than one old file: {sorted(multi)[:10]}')
	group = {g: next(iter(s)) for g, s in groups.items()}
	all_groups = sorted(set(group.values()))
	glyph_order = font.getGlyphOrder()

	def same(*glyphs):
		gs = {group.get(g) for g in glyphs}
		return None not in gs and len(gs) == 1

	def foreign_class(classdef, keep):
		"""Move every glyph of another old file into a fresh class no rule names."""
		cd = dict(classdef.classDefs) if classdef else {}
		fresh = max(cd.values(), default=0) + 1
		for g in glyph_order:
			if group.get(g) is not None and group[g] != keep:
				cd[g] = fresh
		new = otTables.ClassDef()
		new.classDefs = cd
		return new, fresh

	def restrict_cov(cov, keep):
		c = otTables.Coverage()
		c.glyphs = [g for g in cov.glyphs if group.get(g) == keep]
		return c

	def split_by_group(st, cov_attr, fn):
		"""One copy of a subtable per old file, each covering only that file's glyphs."""
		out = []
		for keep in all_groups:
			cov = getattr(st, cov_attr)
			if not any(group.get(g) == keep for g in cov.glyphs):
				continue
			c = copy.deepcopy(st)
			setattr(c, cov_attr, restrict_cov(cov, keep))
			if fn(c, keep) is not False:
				out.append(c)
		return out

	stats = defaultdict(int)

	def context(st, is_gsub):
		chain = st.__class__.__name__.startswith('Chain')
		R = 'Sub' if is_gsub else 'Pos'
		if st.Format == 1:
			set_name = f'Chain{R}RuleSet' if chain else f'{R}RuleSet'
			rule_name = f'Chain{R}Rule' if chain else f'{R}Rule'
			for first, rs in zip(st.Coverage.glyphs, getattr(st, set_name)):
				if rs is None:
					continue
				rules = getattr(rs, rule_name)
				kept = []
				for r in rules:
					seq = [first] + list(r.Input)
					if chain:
						seq += list(r.Backtrack) + list(r.LookAhead)
					(kept if same(*seq) else []).append(r)
				stats['context rules dropped'] += len(rules) - len(kept)
				setattr(rs, rule_name, kept)
				setattr(rs, f'{rule_name}Count', len(kept))
			return [st]
		if st.Format == 2:

			def fix(c, keep):
				names = ['BacktrackClassDef', 'InputClassDef', 'LookAheadClassDef'] if chain else ['ClassDef']
				for n in names:
					new, _ = foreign_class(getattr(c, n), keep)
					setattr(c, n, new)

			out = split_by_group(st, 'Coverage', fix)
			stats['class-context subtables split'] += len(out) - 1
			return out
		if st.Format == 3:
			out = []
			cov_lists = (
				['BacktrackCoverage', 'InputCoverage', 'LookAheadCoverage'] if chain else ['Coverage']
			)
			for keep in all_groups:
				c = copy.deepcopy(st)
				ok = True
				for n in cov_lists:
					covs = [restrict_cov(cv, keep) for cv in getattr(c, n)]
					if any(not cv.glyphs for cv in covs):
						ok = False
					setattr(c, n, covs)
				if ok:
					out.append(c)
			stats['coverage-context subtables split'] += max(0, len(out) - 1)
			return out
		raise SystemExit(f'unknown context format {st.Format}')

	def pair(st):
		if st.Format == 1:
			for first, ps in zip(st.Coverage.glyphs, st.PairSet):
				recs = [r for r in ps.PairValueRecord if same(first, r.SecondGlyph)]
				stats['kern pairs dropped'] += len(ps.PairValueRecord) - len(recs)
				ps.PairValueRecord = recs
				ps.PairValueCount = len(recs)
			return [st]

		def fix(c, keep):
			c.ClassDef2, fresh = foreign_class(c.ClassDef2, keep)
			while c.Class2Count <= fresh:
				for rec in c.Class1Record:
					r2 = otTables.Class2Record()
					r2.Value1 = otBase.ValueRecord(c.ValueFormat1) if c.ValueFormat1 else None
					r2.Value2 = otBase.ValueRecord(c.ValueFormat2) if c.ValueFormat2 else None
					rec.Class2Record.append(r2)
				c.Class2Count += 1

		out = split_by_group(st, 'Coverage', fix)
		stats['class-kern subtables split'] += len(out) - 1
		return out

	def ligature(st):
		for first in list(st.ligatures):
			ligs = [l for l in st.ligatures[first] if same(first, *l.Component)]
			stats['ligatures dropped'] += len(st.ligatures[first]) - len(ligs)
			if ligs:
				st.ligatures[first] = ligs
			else:
				del st.ligatures[first]
		return [st]

	for tag in ('GSUB', 'GPOS'):
		if tag not in font:
			continue
		is_gsub = tag == 'GSUB'
		for lookup in font[tag].table.LookupList.Lookup:
			ext = lookup.LookupType == (7 if is_gsub else 9)
			new_subtables = []
			for wrapper in lookup.SubTable:
				st = wrapper.ExtSubTable if ext else wrapper
				t = st.LookupType if ext else lookup.LookupType
				if is_gsub and t == 4:
					res = ligature(st)
				elif is_gsub and t in (5, 6) or not is_gsub and t in (7, 8):
					res = context(st, is_gsub)
				elif not is_gsub and t == 2:
					res = pair(st)
				elif is_gsub and t == 8:
					raise SystemExit('reverse chaining substitution is not handled')
				else:
					res = [st]
				for r in res:
					if ext:
						w = copy.copy(wrapper)
						w.ExtSubTable = r
						new_subtables.append(w)
					else:
						new_subtables.append(r)
			lookup.SubTable = new_subtables
			lookup.SubTableCount = len(new_subtables)
	return dict(stats)


def to_ttf(data: bytes) -> bytes:
	"""Decompress once: every subset below reads the same upstream font."""
	font = TTFont(io.BytesIO(data))
	font.flavor = None
	buf = io.BytesIO()
	font.save(buf)
	return buf.getvalue()


def to_woff2(font: TTFont) -> bytes:
	# Upstream's own timestamp, so a rerun on the same input writes the same
	# bytes — and the same hashed filename.
	font.recalcTimestamp = False
	font['head'].modified = font['head'].created
	font.flavor = 'woff2'
	# WOFF2's optional hmtx transform (lossless; every WOFF2 decoder has it).
	font.flavorData = WOFF2FlavorData(transformedTables={'glyf', 'loca', 'hmtx'})
	buf = io.BytesIO()
	font.save(buf)
	return buf.getvalue()


def sanitize(data: bytes, label: str):
	try:
		import ots
	except ImportError:
		log('  (opentype-sanitizer not installed: skipping the OTS check)')
		return
	tmp = CACHE / f'{label}.ots-check.woff2'
	tmp.write_bytes(data)
	r = ots.sanitize(str(tmp), capture_output=True)
	tmp.unlink()
	if r.returncode != 0:
		raise SystemExit(f'{label}: rejected by OTS (what Chrome and Firefox run on every web font):\n{r.stderr}')


# --------------------------------------------------------------------------
# Hangul
#
# Upstream 1.2.1's subset CSS never declared the Hangul block, so Korean has
# always rendered in the system font — Apple SD Gothic Neo, Malgun Gothic or
# Noto beside Inter, which is the mismatch Interlude exists to fix. 1.3's own
# subsets slice the block in Unicode order, 200 syllables to a ~94KB file, so a
# Korean post touches nearly all 56 of them.
#
# Here the syllables are sliced by who needs them. The site's own text comes
# first, in the order a visitor meets it — the header (every page), the post
# chrome, titles (every listing), descriptions (the home page), then post
# bodies by how many posts use the syllable — and every other syllable follows
# in frequency tiers, so a comment pulls only the tier its rarer syllables are
# in. The site's chunks are declared in app.css; the tiers wait in the subset
# sheet with the rest of the long tail.


def hangul_usage():
	# Syllables, and the compatibility jamo posts use on their own (ㅋㅋ).
	syllable = lambda text: {
		ord(c) for c in text if ord(c) in HANGUL_SYLLABLES or ord(c) in HANGUL_COMPAT_JAMO
	}
	chrome, ui, titles, descriptions = set(), set(), set(), set()
	body = defaultdict(int)
	for path in sorted((ROOT / 'src').rglob('*')):
		rel = path.relative_to(ROOT).as_posix()
		if not path.is_file() or path.suffix not in ('.md', '.svelte', '.js', '.html'):
			continue
		if '.test.' in path.name or rel.startswith('src/test/'):
			continue
		if any(rel.startswith(p) for p in HANGUL_IGNORED_SOURCES):
			continue
		text = strip_comments(path.read_text('utf8'), path.suffix)
		if rel.startswith('src/content/'):
			front, rest = '', text
			if text.startswith('---'):
				_, front, rest = text.split('---', 2)
			for line in front.splitlines():
				key = line.split(':', 1)[0].strip()
				if key in ('title', 'series'):
					titles |= syllable(line)
				elif key == 'description':
					descriptions |= syllable(line)
			for cp in syllable(rest):
				body[cp] += 1
		elif any(rel.startswith(p) for p in HANGUL_CHROME_SOURCES):
			chrome |= syllable(text)
		else:
			ui |= syllable(text)
	return chrome, ui, titles, descriptions, body


def hangul_chunks():
	"""[(kind, codepoints)] — kind `site` is declared in app.css, `tail` in the subset sheet."""
	tiers = [
		[ord(c) for c in line]
		for line in HANGUL_FREQUENCY.read_text('utf8').splitlines()
		if line and not line.startswith('#')
	]
	rank = {cp: i for i, tier in enumerate(tiers) for cp in tier}
	if set(rank) != set(HANGUL_SYLLABLES):
		raise SystemExit(f'{HANGUL_FREQUENCY.name} does not hold every Hangul syllable exactly once')
	chrome, ui, titles, descriptions, body = hangul_usage()
	taken, chunks = set(), []

	def add(cps, key, size=None):
		cps = sorted(set(cps) - taken, key=key)
		size = size or len(cps)
		for i in range(0, len(cps), size):
			chunks.append(('site', set(cps[i : i + size])))
		taken.update(cps)

	by_rank = lambda cp: (rank.get(cp, len(tiers)), cp)
	add(chrome, by_rank)
	add(ui, by_rank)
	add(titles, by_rank, HANGUL_CHUNK)
	add(descriptions, by_rank, HANGUL_CHUNK)
	add(body, lambda cp: (-body[cp], rank.get(cp, len(tiers)), cp), HANGUL_CHUNK)
	# A tier the site has already mostly emptied joins the next one rather than
	# ship as a file of a dozen glyphs.
	pending = set()
	for tier in tiers:
		pending |= set(tier) - taken
		if len(pending) >= 40:
			chunks.append(('tail', pending))
			taken |= pending
			pending = set()
	if pending:
		chunks.append(('tail', pending))
	chunks.append(('tail', set(HANGUL_COMPAT_JAMO) - taken))
	return chunks


def same_outline(a, b, tol=1e-3):
	"""Equal to a thousandth of a font unit.

	1.3's Hangul comes out of HarfBuzz up to 1e-4 units away from the whole font
	once the wdth tuples are gone: the same deltas, summed in a different order
	in floating point. A thousandth of a unit is a twenty-millionth of a pixel at
	16px. (The 1.2.1 Latin is compared exactly, and is exact.)
	"""
	if a is None or b is None or a[0] != b[0] or len(a[1]) != len(b[1]):
		return a == b
	for (op1, pts1), (op2, pts2) in zip(a[1], b[1]):
		if op1 != op2 or len(pts1) != len(pts2):
			return False
		for p, q in zip(pts1, pts2):
			if abs(p[0] - q[0]) > tol or abs(p[1] - q[1]) > tol:
				return False
	return True


def verify_hangul(full: bytes, built: list[tuple[str, set[int], bytes]]):
	"""Each chunk draws and shapes its syllables exactly as the whole 1.3 font does."""
	sh = Shaper()
	of = {cp: i for i, (_, cps, _) in enumerate(built) for cp in cps}
	problems = []
	site = {cp for kind, cps, _ in built if kind == 'site' for cp in cps}
	sample = sorted(site | {cp for cp in of if cp % 7 == 0})
	for w, o in [(400, 14), (500, 20), (600, 32), (900, 14), (300, 32)]:
		whole = sh.font('hangul-full', full, (w, o))
		for cp in sample:
			i = of[cp]
			if not same_outline(sh.outline(sh.font(f'hangul-{i}', built[i][2], (w, o)), cp), sh.outline(whole, cp)):
				problems.append(f'outline U+{cp:04X} at wght {w} opsz {o}')
	runs = sorted(
		{
			run
			for path in (ROOT / 'src' / 'content').rglob('*.md')
			for run in re.findall(r'[\uac00-\ud7a3\u3131-\u318e]+', path.read_text('utf8'))
		}
	)
	for inst in [(400, 14), (600, 24)]:
		for run in runs:
			a = sh.shape(run, lambda c: 'all', lambda g, i: sh.font('hangul-full', full, i), inst, {})
			b = sh.shape(run, lambda c: of[c], lambda g, i: sh.font(f'hangul-{g}', built[g][2], i), inst, {})
			if a != b:
				problems.append(f'shaping {run!r} at {inst}')
	log(f'  hangul: {len(sample)} syllables x 5 instances, {len(runs)} Korean runs from the content')
	if problems:
		for p in problems[:20]:
			log('  DIFF', p)
		raise SystemExit(f'{len(problems)} Hangul differences from interlude-ui {HANGUL_VERSION}')


# --------------------------------------------------------------------------
# Verification


class Shaper:
	def __init__(self):
		import uharfbuzz as hb

		self.hb = hb
		self.faces, self.fonts, self.drawn = {}, {}, {}

	def font(self, key, data, inst):
		hb = self.hb
		if key not in self.faces:
			f = TTFont(io.BytesIO(data))
			f.flavor = None
			b = io.BytesIO()
			f.save(b)
			self.faces[key] = hb.Face(hb.Blob(b.getvalue()))
		k = (key, inst)
		if k not in self.fonts:
			face = self.faces[key]
			font = hb.Font(face)
			tags = {a.tag for a in face.axis_infos}
			v = {'wght': inst[0], 'opsz': inst[1], 'wdth': 100}
			font.set_variations({t: x for t, x in v.items() if t in tags})
			self.fonts[k] = font
		return self.fonts[k]

	def outline(self, font, cp):
		gid = font.get_nominal_glyph(cp)
		if gid is None:
			return None
		pen = RecordingPen()
		font.draw_glyph_with_pen(gid, pen)
		return font.get_glyph_h_advance(gid), pen.value

	def drawing(self, font, gid):
		k = (id(font), gid)
		if k not in self.drawn:
			pen = RecordingPen()
			font.draw_glyph_with_pen(gid, pen)
			self.drawn[k] = repr(pen.value)
		return self.drawn[k]

	def shape(self, text, group_of, font_of, inst, features):
		hb = self.hb
		out, i = [], 0
		while i < len(text):
			g, j = group_of(ord(text[i])), i
			while j < len(text) and group_of(ord(text[j])) == g:
				j += 1
			font = font_of(g, inst)
			buf = hb.Buffer()
			buf.add_str(text[i:j])
			buf.guess_segment_properties()
			hb.shape(font, buf, features)
			for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
				out.append((pos.x_advance, pos.x_offset, pos.y_offset, self.drawing(font, info.codepoint)))
			i = j
		return out


def verify(files, drawn_by, built: dict[str, bytes], members: dict[str, set[int]], strings: list[str]):
	"""Prove the new files draw and shape exactly what the old ones did."""
	sh = Shaper()
	legacy = lambda name: files[f'dynamic-subset/woff2/InterludeVariable.subset.{name}.woff2']
	new_of = {cp: name for name, cps in members.items() for cp in cps}
	problems = []

	# 1. Every glyph, every weight the CSS uses, across the optical-size axis.
	for name, cps in members.items():
		for w, o in itertools.product(VERIFY_WGHT, VERIFY_OPSZ):
			new = sh.font(name, built[name], (w, o))
			for cp in sorted(cps):
				old = sh.font(drawn_by[cp], legacy(drawn_by[cp]), (w, o))
				if sh.outline(new, cp) != sh.outline(old, cp):
					problems.append(f'outline U+{cp:04X} {name} at wght {w} opsz {o}')
	log(f'  outlines: {sum(len(c) for c in members.values())} characters x {len(VERIFY_WGHT) * len(VERIFY_OPSZ)} instances')

	# 2. Shaping: every ordered pair, a context set of triples, and the site's
	#    own strings — split into runs by old file versus by new file.
	universe = sorted(new_of)
	seqs = [a + b for a, b in itertools.product(map(chr, universe), repeat=2)]
	ctx = 'AHTVOaxn10 ()-:.,'
	seqs += [a + chr(c) + b for c in universe for a in ctx for b in ctx]
	seqs += [s for s in strings if all(ord(ch) in new_of for ch in s)]
	# Characters that shared an old file but sit in different new files lose
	# whatever they did to each other: no cut of the layout tables can bring
	# kerning back across two files. Those are counted and reported, not hidden;
	# any other difference is a bug.
	split = defaultdict(set)
	for inst in VERIFY_SHAPE_INSTANCES:
		for features in ({}, {'tnum': True}):
			for s in seqs if not features else [x for x in seqs if any(c.isdigit() for c in x)]:
				a = sh.shape(s, lambda c: drawn_by[c], lambda g, i: sh.font(g, legacy(g), i), inst, features)
				b = sh.shape(s, lambda c: new_of[c], lambda g, i: sh.font(g, built[g], i), inst, features)
				if a == b:
					continue
				cps = [ord(c) for c in s]
				pairs = list(zip(cps, cps[1:]))
				if any(drawn_by[x] == drawn_by[y] and new_of[x] != new_of[y] for x, y in pairs):
					split[s].add(inst)
				else:
					problems.append(f'shaping {s!r} at {inst} {features}')
	log(f'  shaping: {len(seqs)} sequences x {len(VERIFY_SHAPE_INSTANCES)} instances x up to 2 feature sets')
	if problems:
		for p in problems[:40]:
			log('  DIFF', p)
		raise SystemExit(f'{len(problems)} differences from the shipped fonts; nothing written')
	return sorted(split)


def page_strings() -> list[str]:
	"""Runs of text from the content, for the shaping check."""
	out = set()
	for path in (ROOT / 'src' / 'content').rglob('*.md'):
		for line in path.read_text('utf8').splitlines():
			for piece in re.split(r'[ᄀ-ᇿ㄰-㆏가-힣]+', line):
				piece = piece.strip()
				if piece:
					out.add(piece[:200])
	return sorted(out)


# --------------------------------------------------------------------------
# Output


LICENSE_HEADER = '''/*
Interlude by avanturation — https://github.com/avanturation/interlude
Built on Inter (c) 2020 The Inter Project Authors and
Pretendard (c) 2021 The Pretendard Project Authors.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
See LICENSE.txt in this directory; also available with a FAQ at:
http://scripts.sil.org/OFL
*/
'''

HANGUL_TAIL_NOTE = f'''/* Hangul from interlude-ui {HANGUL_VERSION}, built by the same script: every
   syllable the site's own text does not use, in frequency tiers, and the
   compatibility jamo. */
'''

TAIL_NOTE = f'''/* Generated by scripts/fonts/build-interlude.py from interlude-ui@{UPSTREAM_VERSION}.
   Upstream's own subset files, unchanged. Each range is cut to the characters
   that file still draws; the rest are in the core and extended files declared
   in src/app.css. */
'''


def face_css(url, cps, comment):
	return (
		f'/* {comment} */\n@font-face {{\n\tfont-family: \'{FAMILY}\';\n{DESCRIPTORS}'
		f"\tsrc: url({url}) format('woff2');\n\tunicode-range: {format_ranges(cps)};\n}}\n"
	)


def replace_between(path: Path, start: str, end: str, body: str):
	text = path.read_text('utf8')
	a, b = text.index(start), text.index(end)
	path.write_text(text[: a + len(start)] + body + text[b:], 'utf8')


def main():
	ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
	ap.add_argument('--no-verify', action='store_true', help='skip the HarfBuzz comparison (not for commits)')
	ap.add_argument(
		'--full-latin-ext-a',
		action='store_true',
		help='also put the 99 Latin Extended-A letters the shipped CSS never covered (Č Ł Ş Ž …) '
		'in the extended file. A visible change: they render in the system font today.',
	)
	ap.add_argument(
		'--small-core',
		action='store_true',
		help='core = ASCII + punctuation + arrows only; every accented letter goes to the extended '
		'file. ~16KB less on every page, but an accented letter next to a curly quote, dash or '
		'middle dot no longer kerns or takes a case form against it (228 pairs, listed by --verify).',
	)
	args = ap.parse_args()

	files = fetch_upstream()
	full = to_ttf(files['woff2/InterludeVariable.woff2'])
	faces, drawn_by = legacy_faces(files)
	full_cmap = set(TTFont(io.BytesIO(full)).getBestCmap())

	# ---- character sets
	seed = (set(ASCII) | set(CORE_PUNCTUATION) | set(CORE_ARROWS)) & full_cmap
	used = site_characters()
	latin = {cp for cp in LATIN_1 if cp in drawn_by}
	latin |= {cp for cp in LATIN_EXT_A if cp in drawn_by}
	# Interlude-drawn characters the site's source uses, except CJK — that stays
	# with upstream's own files, which is where it renders from today.
	latin |= {cp for cp in used if cp in drawn_by and not is_cjk(cp)}
	latin = (latin - seed) & full_cmap
	if args.small_core:
		core = seed
	else:
		# A letter that shared an old file with the core's punctuation kerned
		# against it (`é”`, `’À`, `É–`): it has to share the new file too, or the
		# two would be shaped as separate runs. Everything else from those old
		# files joins the core; characters from other old files (× ° ± ¥ − ⚠ …)
		# never touched it and can wait in the extended file.
		shared = {drawn_by[cp] for cp in seed}
		core = seed | {cp for cp in latin if drawn_by[cp] in shared}
	extended = latin - core
	if args.full_latin_ext_a:
		extended |= {cp for cp in LATIN_EXT_A if cp in full_cmap and cp not in drawn_by}
	group_of = lambda cp: drawn_by.get(cp, 'latin-ext-a')

	# ---- build
	built, stats = {}, {}
	for name, cps in (('core', core), ('extended', extended)):
		font = subset_font(full, cps)
		st = isolate_layout(font, glyph_groups(font, group_of))
		data = to_woff2(font)
		# Round-trip through the compiler once more: what verify() reads is what
		# ships.
		sanitize(data, name)
		built[name] = data
		check = TTFont(io.BytesIO(data))
		stats[name] = {
			'bytes': len(data),
			'glyphs': check['maxp'].numGlyphs,
			'characters': len(check.getBestCmap()),
			'axes': {a.axisTag: [a.minValue, a.defaultValue, a.maxValue] for a in check['fvar'].axes},
			'features': sorted(
				{r.FeatureTag for t in ('GSUB', 'GPOS') if t in check for r in check[t].table.FeatureList.FeatureRecord}
			),
			'tables': sorted(t for t in check.keys() if t != 'GlyphOrder'),
			'isolation': st,
		}
		if set(check.getBestCmap()) != cps:
			raise SystemExit(f'{name}: cmap does not match the requested characters')
		log(f'{name}: {len(data)} bytes, {stats[name]["glyphs"]} glyphs, {len(cps)} characters; {st}')

	if not args.no_verify:
		log('verifying against the shipped 1.2.1 subset files…')
		members = {'core': core, 'extended': extended}
		if args.full_latin_ext_a:
			members['extended'] = {cp for cp in extended if cp in drawn_by}
		split = verify(files, drawn_by, built, members, page_strings())
		if split and not args.small_core:
			raise SystemExit(f'{len(split)} sequences shape differently: {" ".join(split[:50])}')
		if split:
			log(f'  identical, except {len(split)} sequences across the core/extended split:')
			log('   ', ' '.join(split))
		else:
			log('  identical')

	# ---- Hangul, from the later release
	log(f'building Hangul from interlude-ui {HANGUL_VERSION}…')
	hangul_full = to_ttf(fetch_upstream(HANGUL_VERSION, HANGUL_INTEGRITY)['woff2/InterludeVariable.woff2'])
	hangul = []
	hangul_cmap = set(TTFont(io.BytesIO(hangul_full), lazy=True).getBestCmap())
	for kind, cps in hangul_chunks():
		cps &= hangul_cmap
		data = to_woff2(match_rasterizer(subset_font(hangul_full, cps), full))
		sanitize(data, 'hangul')
		drawn = set(TTFont(io.BytesIO(data)).getBestCmap())
		if drawn != cps:
			raise SystemExit(f'a Hangul chunk draws {format_ranges(drawn ^ cps)} unexpectedly')
		hangul.append((kind, cps, data))
	site_bytes = sum(len(d) for k, _, d in hangul if k == 'site')
	log(
		f'hangul: {len(hangul)} files, {sum(len(d) for _, _, d in hangul)} bytes; '
		f'the site\'s own text is {sum(1 for k, *_ in hangul if k == "site")} of them, {site_bytes} bytes'
	)
	if not args.no_verify:
		verify_hangul(hangul_full, hangul)

	# ---- write fonts
	names = {}
	for old in FONT_DIR.glob('interlude-*.woff2'):
		old.unlink()
	for name, data in built.items():
		h = hashlib.sha256(data).hexdigest()[:10]
		names[name] = f'interlude-{name}.{h}.woff2'
		(FONT_DIR / names[name]).write_bytes(data)

	HANGUL_DIR.mkdir(parents=True, exist_ok=True)
	for old in HANGUL_DIR.glob('*.woff2'):
		old.unlink()
	hangul_css = {'site': [], 'tail': []}
	hangul_urls = []
	for i, (kind, cps, data) in enumerate(hangul):
		fname = f'{i:02d}.{hashlib.sha256(data).hexdigest()[:10]}.woff2'
		(HANGUL_DIR / fname).write_bytes(data)
		url = f'{URL_PREFIX}/hangul/{fname}'
		hangul_urls.append(url)
		hangul_css[kind].append(face_css(url, cps, f'Hangul {i}'))

	# ---- long tail: upstream's files, ranges cut to what they still draw
	# Only the jamo 1.3 still has leave upstream's file: it dropped 41 archaic
	# ones (U+3165–318E) that 1.2.1 draws.
	taken = core | extended | {cp for _, cps, _ in hangul for cp in cps}
	tail_css, tail_files = [], {}
	for name, _ranges, _cmap in faces:
		cps = {cp for cp, n in drawn_by.items() if n == name} - taken
		fname = f'InterludeVariable.subset.{name}.woff2'
		if not cps:
			continue
		tail_files[fname] = files[f'dynamic-subset/woff2/{fname}']
		tail_css.append(face_css(f'{URL_PREFIX}/woff2-dynamic-subset/{fname}', cps, f'[{name}]'))
	TAIL_DIR.mkdir(parents=True, exist_ok=True)
	for old in TAIL_DIR.glob('*.woff2'):
		if old.name not in tail_files:
			old.unlink()
	for fname, data in tail_files.items():
		(TAIL_DIR / fname).write_bytes(data)
	TAIL_CSS.write_text(
		LICENSE_HEADER + TAIL_NOTE + ''.join(tail_css) + HANGUL_TAIL_NOTE + ''.join(hangul_css['tail']),
		'utf8',
	)

	# ---- app.css, app.html
	css = (
		'\n'
		+ face_css(f'{URL_PREFIX}/{names["core"]}', core, 'Core: preloaded from app.html.')
		+ face_css(
			f'{URL_PREFIX}/{names["extended"]}',
			extended,
			'Extended: only fetched by a page that draws one of these.',
		)
		+ f'/* Hangul from interlude-ui {HANGUL_VERSION}: the syllables the site itself draws. */\n'
		+ ''.join(hangul_css['site'])
	)
	replace_between(APP_CSS, '/* @generated interlude:start */', '/* @generated interlude:end */', css)
	replace_between(
		APP_HTML,
		'<!-- @generated interlude:preload -->',
		'<!-- @generated interlude:end -->',
		f'\n\t\t<link\n\t\t\trel="preload"\n\t\t\tas="font"\n\t\t\ttype="font/woff2"\n\t\t\thref="{URL_PREFIX}/{names["core"]}"\n\t\t\tcrossorigin\n\t\t/>\n\t\t',
	)

	MANIFEST.parent.mkdir(parents=True, exist_ok=True)
	MANIFEST.write_text(
		json.dumps(
			{
				'generatedBy': 'scripts/fonts/build-interlude.py',
				'upstream': f'interlude-ui@{UPSTREAM_VERSION}',
				'features': FEATURES,
				'files': {
					name: {**stats[name], 'url': f'{URL_PREFIX}/{names[name]}', 'unicodeRange': format_ranges(cps)}
					for name, cps in (('core', core), ('extended', extended))
				},
				# Characters Interlude draws only from the long tail. The test fails
				# when the site's source starts using one outside CJK.
				'tail': format_ranges(cp for cp in set(drawn_by) - taken if not is_cjk(cp)),
				'hangul': {
					'upstream': f'interlude-ui@{HANGUL_VERSION}',
					'files': len(hangul),
					'bytes': sum(len(d) for _, _, d in hangul),
					'site': [
						{'url': url, 'bytes': len(d), 'characters': len(c)}
						for url, (k, c, d) in zip(hangul_urls, hangul)
						if k == 'site'
					],
				},
			},
			indent='\t',
		)
		+ '\n',
		'utf8',
	)
	paths = [APP_CSS, APP_HTML, TAIL_CSS, MANIFEST]
	try:
		subprocess.run(['npx', 'prettier', '--write', *map(str, paths)], cwd=ROOT, check=True, capture_output=True)
	except (OSError, subprocess.CalledProcessError) as e:
		log(f'prettier did not run ({e}); run `npx prettier --write` on {", ".join(p.name for p in paths)}')
	for name in names:
		log(f'wrote {names[name]}')


if __name__ == '__main__':
	main()
