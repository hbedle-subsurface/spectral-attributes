"""Replace whole prose elements located by a unique substring.

Matching on a substring and replacing the enclosing element avoids having to
reproduce the source file's line wrapping exactly. Used for the plain-instruction
pass; see docs/REWRITE-BRIEF.md section 6.
"""
import re


def block_span(s, anchor):
    i = s.find(anchor)
    if i < 0:
        raise SystemExit('anchor not found: ' + anchor[:70])
    if s.find(anchor, i + 1) >= 0:
        raise SystemExit('anchor not unique: ' + anchor[:70])
    start = max(s.rfind('<p ', 0, i), s.rfind('<div ', 0, i), s.rfind('<span>', 0, i))
    tag = re.match(r'<(\w+)', s[start:]).group(1)
    depth, j = 0, start
    while True:
        m = re.compile(r'<%s[\s>]|</%s>' % (tag, tag)).search(s, j)
        if not m:
            raise SystemExit('unbalanced around: ' + anchor[:70])
        if m.group(0).startswith('</'):
            depth -= 1
            if depth == 0:
                return start, m.end()
        else:
            depth += 1
        j = m.end()


def apply(path, edits):
    s = open(path).read()
    for anchor, new in edits:
        a, b = block_span(s, anchor)
        s = s[:a] + new + s[b:]
    open(path, 'w').write(s)
    print('%s: %d blocks rewritten' % (path, len(edits)))
