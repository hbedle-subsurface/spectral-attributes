# Adding the click-a-term glossary to a repository

`assets/glossary.js` marks technical terms in the step prose and shows their
definition where the word is. A student who meets **notch** four modules after
it was defined does not have to go looking for it.

---

## 1. Copy the file

Copy `assets/glossary.js`. The term list lives inside it, at the top, so one
file carries both the behavior and the content.

## 2. Add one script tag per module

```html
<script src="../assets/popout.js"></script>
<script src="../assets/panelout.js"></script>
<script src="../assets/glossary.js"></script>
```

No markup change and no stylesheet change. The script injects its own styles.

## 3. What gets marked

Terms are marked inside `.tabpane p.lede`, `p.qbox`, `.legend span` and `li`.
Headings, captions, control labels, links, the Key points pane (`#pk`) and the
Method pane (`#pm`) are left alone, so a term is not turned into a button inside
its own definition.

At most one occurrence of each term is marked per step. Longer terms are matched
first, so *peak frequency* is marked as one term rather than as *frequency*.

## 4. Writing an entry

Every entry has two parts, and they are kept apart deliberately:

```js
'notch': {
  mod: 'tuning', title: 'Module 04',
  what:  'A frequency at which the two reflections from a bed cancel...',
  earth: 'The spacing of notches measures the bed thickness directly...'
}
```

- **`what`** — what the quantity is, arithmetically or physically. No geology.
  This part is always true.
- **`earth`** — what that quantity commonly corresponds to in the subsurface,
  and what it does not. This part is a common case with exceptions.

They appear in the card under the headings *What it is* and *In the rocks*.
Mixing them produces the failure the set exists to avoid: a student who has been
told that a bright amplitude means gas, rather than that a bright amplitude is a
sum of two reflections and that one of the several things capable of producing
one is gas.

`aka` holds spellings and abbreviations that open the same entry. `mod` is the
file name of the module that introduces the term, without the extension; the
link is built at run time, so the same file works from a module page and from
the landing page.

## 5. The reference window

Each card carries **Keep in a window**. Terms accumulate in one window per
module, so a student can collect the words they did not know from a step and
keep them beside it. Nothing is fetched, sent or stored, and it works from a
`file://` copy.

## 6. Sharing the list across repositories

The list is written for this set but most of its entries are general. When
copying it to another repository, keep the entries that apply, delete those that
do not, and change `mod` and `title` to point at the module in that set that
introduces the term. A card that links to a module the reader cannot reach is
worse than no card.
