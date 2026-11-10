"""The assertions jsdom cannot make: where things actually land.

Three of our fixes are geometric -- the right-click menu clipped by the pane
it lived in, the column menu misplaced inside a transformed ancestor, and the
thumbnail box collapsing because it had a width but no height. jsdom reports
every getBoundingClientRect as zeroes, so the vitest suite is blind to all
three and would pass while each regressed.

Run against the fixture app:

    npm run dev          # or: make test-browser, which does both
    python3 -I test/browser/geometry.py

Chrome is driven over the DevTools protocol by cdp.py, vendored beside this
file from NewArrayscapeWebsite/scripts. Playwright would do the same job, but
its advantages -- managing browsers, CI, traces -- buy nothing for a suite run
by hand on one Mac, against a second toolchain to install.

The test that matters for anything clipped is a hit test. A clipped element
still reports a full rect, so asking "what is painted at this corner?" is the
only question whose answer a user would recognise.
"""
import os
import sys
import time
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cdp import Chrome

BASE = os.environ.get("FIXTURES_URL", "http://localhost:5173")

failures = []
checks = 0


def check(label, ok, detail=""):
    global checks
    checks += 1
    print("  %-56s %s%s" % (label, "ok" if ok else "FAIL", "  " + detail if detail else ""))
    if not ok:
        failures.append(label)


def j(ch, expr):
    return json.loads(ch.evaluate("JSON.stringify(%s)" % expr))


def scenario(ch, key, settle=2.5):
    ch.goto("%s/dev/?scenario=%s" % (BASE, key), settle=settle)
    time.sleep(1.0)


ROW = """(() => {
  const rows = [...document.querySelectorAll('.file-item-container')];
  const el = rows[%s];
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return {x: Math.round(b.x + 60), y: Math.round(b.y + b.height / 2),
          name: el.innerText.split('\\n')[0].trim()};
})()"""


def right_click(ch, x, y):
    for t in ("mousePressed", "mouseReleased"):
        ch.send("Input.dispatchMouseEvent", {
            "type": t, "x": x, "y": y, "button": "right", "clickCount": 1,
            "modifiers": 0, "buttons": 2 if t == "mousePressed" else 0})
        time.sleep(0.08)
    time.sleep(0.7)


# --- the thumbnail fills its box -------------------------------------------
# The box had `width: iconSize` and no height, so `height: 100%` on a picture
# resolved against the content -- itself -- and a 2:1 image rendered half as
# tall as the row's icon.
THUMBS = """(() => {
  const rows = [...document.querySelectorAll('.file-item-container')];
  return rows.map(r => {
    const box = r.querySelector('div[style*="flex-shrink"]') || r.firstElementChild;
    const b = box.getBoundingClientRect();
    const img = box.querySelector('img');
    const ib = img && img.getBoundingClientRect();
    const painted = document.elementFromPoint(
      Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2));
    return {
      name: r.innerText.split('\\n')[0].trim(),
      box: {w: Math.round(b.width), h: Math.round(b.height)},
      img: ib ? {w: Math.round(ib.width), h: Math.round(ib.height)} : null,
      paintedTag: painted ? painted.tagName.toLowerCase() : null,
      hasSvg: !!box.querySelector('svg'),
    };
  });
})()"""


def test_thumbnails(ch):
    print("thumbnails fill a square box, and rows without one keep their icon")
    scenario(ch, "thumbnails")
    rows = j(ch, THUMBS)
    check("the scenario listed some rows", len(rows) > 0, "got %d" % len(rows))
    withimg = [r for r in rows if r["img"]]
    check("at least one row carries a picture", len(withimg) > 0)
    for r in withimg:
        check("%s: box is square" % r["name"],
              r["box"]["w"] == r["box"]["h"], str(r["box"]))
        # The element, not the painted pixels. Whether the host fits the
        # picture with `contain` or `cover` inside that element is its own
        # choice, and this cannot tell the two apart -- what the component
        # owes is a box with a height, so `height: 100%` has something to
        # resolve against.
        check("%s: the picture's element fills the box" % r["name"],
              r["img"] == r["box"], "img=%s box=%s" % (r["img"], r["box"]))
        check("%s: the picture is what is painted" % r["name"],
              r["paintedTag"] == "img", "painted=<%s>" % r["paintedTag"])
    for r in [x for x in rows if not x["img"]]:
        check("%s: falls back to an icon" % r["name"], r["hasSvg"])


# --- the right-click menu is not clipped -----------------------------------
CTX = """(() => {
  const m = document.querySelector('.fm-context-menu');
  if (!m) return null;
  const b = m.getBoundingClientRect();
  const panes = [...document.querySelectorAll('.files')];
  const p = panes[panes.length - 1].getBoundingClientRect();
  const at = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !!(el && el.closest('.fm-context-menu'));
  };
  return {
    reachesPastPane: Math.round(b.bottom - p.bottom),
    topLeftVisible: at(b.left + 6, b.top + 6),
    bottomLeftVisible: at(b.left + 6, b.bottom - 6),
    bottomRightVisible: at(b.right - 6, b.bottom - 6),
    insideWindow: b.top >= 0 && b.left >= 0
                  && b.bottom <= innerHeight && b.right <= innerWidth,
    inBody: !!(m.parentElement && m.parentElement === document.body),
  };
})()"""


def test_context_menu(ch):
    print("the right-click menu stays visible on the last row of a short pane")
    scenario(ch, "context-menu")
    row = j(ch, ROW % "rows.length - 1")
    if not row:
        check("a last row to right-click", False)
        return
    right_click(ch, row["x"], row["y"])
    m = j(ch, CTX)
    if not m:
        check("the menu opened", False)
        return
    check("the menu opened", True, "on %s" % row["name"])
    check("it is portalled into document.body", m["inBody"])
    check("its top-left corner is painted by the menu", m["topLeftVisible"])
    check("its bottom-left corner is painted by the menu", m["bottomLeftVisible"])
    check("its bottom-right corner is painted by the menu", m["bottomRightVisible"])
    check("it is inside the window", m["insideWindow"])


# --- the column menu lands under the three dots ----------------------------
# The control is the 30px-wide `.column-header` span at the end of the header
# strip, holding a FaEllipsisV whose onClick opens the menu. Picking "the first
# svg in the header" instead finds a sort arrow and clicks nothing.
DOTS = """(() => {
  const spans = [...document.querySelectorAll('.column-header')];
  const host = spans.find(e => e.style.width === '30px') || spans[spans.length - 1];
  const dots = host && host.querySelector('svg');
  if (!dots) return null;
  const b = dots.getBoundingClientRect();
  return {x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2)};
})()"""

# Portalled into document.body by our patch, so look for it as a child of body
# rather than anywhere in the tree -- being there is half of what is under test.
MENU = """(() => {
  const m = [...document.body.children].find(
    e => e.classList && e.classList.contains('category-view'));
  if (!m) return null;
  const b = m.getBoundingClientRect();
  return {left: Math.round(b.left), top: Math.round(b.top),
          right: Math.round(b.right), bottom: Math.round(b.bottom),
          inBody: !!(m.parentElement && m.parentElement === document.body),
          insideWindow: b.top >= 0 && b.left >= 0
                        && b.bottom <= innerHeight && b.right <= innerWidth};
})()"""


def test_column_menu(ch):
    print("the column menu lands near the dots even inside a transformed ancestor")
    scenario(ch, "column-menu")
    d = j(ch, DOTS)
    if not d:
        check("found the column-menu control", False,
              "selector needs updating for this build")
        return
    ch.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": d["x"], "y": d["y"],
                                        "button": "left", "clickCount": 1, "buttons": 1})
    ch.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": d["x"], "y": d["y"],
                                         "button": "left", "clickCount": 1, "buttons": 0})
    time.sleep(0.8)
    m = j(ch, MENU)
    if not m:
        check("the column menu opened", False)
        return
    check("the column menu opened", True)
    check("it is portalled into document.body", m["inBody"])
    check("it is inside the window", m["insideWindow"], str(m))
    # The transform offsets the wrapper by 40px down and 24px across. Fixed
    # positioning inside it used to add that offset on top of coordinates that
    # were already the viewport's.
    check("it is vertically near the dots (within 60px)",
          abs(m["top"] - d["y"]) < 60, "menu top=%d dots y=%d" % (m["top"], d["y"]))


# --- the category menu lands under its button ------------------------------
BUTTON = """(() => {
  const b = [...document.querySelectorAll('.category-button')]
    .find(e => e.innerText.trim().startsWith('Usage'));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return {x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
          bottom: Math.round(r.bottom), left: Math.round(r.left)};
})()"""

CATMENU = """(() => {
  const m = [...document.body.children].find(
    e => e.classList && e.classList.contains('category-view'));
  if (!m) return null;
  const b = m.getBoundingClientRect();
  return {left: Math.round(b.left), top: Math.round(b.top),
          right: Math.round(b.right), bottom: Math.round(b.bottom),
          inBody: !!(m.parentElement && m.parentElement === document.body),
          insideWindow: b.top >= 0 && b.left >= 0
                        && b.bottom <= innerHeight && b.right <= innerWidth};
})()"""


def test_category_menu(ch):
    print("the category menu lands under its button, inside a transformed ancestor")
    scenario(ch, "category-menu")
    b = j(ch, BUTTON)
    if not b:
        check("found the Usage button", False)
        return
    ch.send("Input.dispatchMouseEvent", {"type": "mousePressed", "x": b["x"], "y": b["y"],
                                        "button": "left", "clickCount": 1, "buttons": 1})
    ch.send("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": b["x"], "y": b["y"],
                                         "button": "left", "clickCount": 1, "buttons": 0})
    time.sleep(0.8)
    m = j(ch, CATMENU)
    if not m:
        check("the category menu opened", False)
        return
    check("the category menu opened", True)
    check("it is portalled into document.body", m["inBody"])
    check("it is inside the window", m["insideWindow"], str(m))
    # The wrapper is offset 40px down and 24px across. Placement that depended
    # on the cascade, or on `fixed` inside that transform, would not track the
    # button.
    check("it sits just below the button (within 24px)",
          abs(m["top"] - b["bottom"]) < 24,
          "menu top=%d button bottom=%d" % (m["top"], b["bottom"]))
    check("it is left-aligned with the button (within 24px)",
          abs(m["left"] - b["left"]) < 24,
          "menu left=%d button left=%d" % (m["left"], b["left"]))


# --- the search box is not clipped by the row it sits in -------------------
# The breadcrumb row was pinned to a 22px height and set `overflow-x: hidden`,
# which makes the other axis compute to `auto`: the row became a scroll
# container shorter than the input inside it, so the bottom of the search box
# was simply not painted. A rect is no use for this -- the input reports its
# full height whether or not any of it survives the clip -- so the question has
# to be asked as a hit test, which is also the question a user would ask: can I
# see the thing.
SEARCH = """(() => {
  const input = document.querySelector('.search-input');
  if (!input) return null;
  const bar = input.closest('.breadcrumb');
  if (!bar) return null;
  const i = input.getBoundingClientRect();
  const b = bar.getBoundingClientRect();
  const at = (x, y) => document.elementFromPoint(Math.round(x), Math.round(y));
  const midX = i.x + i.width / 2;
  return {
    height: Math.round(i.height),
    top: Math.round(i.top), bottom: Math.round(i.bottom),
    right: Math.round(i.right),
    barTop: Math.round(b.top), barBottom: Math.round(b.bottom),
    barRight: Math.round(b.right),
    overflowing: bar.scrollHeight > bar.clientHeight + 1,
    topIsInput: at(midX, i.top + 2) === input,
    bottomIsInput: at(midX, i.bottom - 2) === input,
  };
})()"""


def test_search_box(ch):
    print("the search box is wholly visible in the row that holds it")
    # Both scenarios, because the one that matters is the one the default
    # cannot show: at the browser's own 13.33px the box fits whatever the row
    # does, so 'assets' would pass over the bug and 'host-css' is where a real
    # host -- the dashboard, Bootstrap-reset and 16px -- actually lives.
    for key in ("assets", "host-css"):
        scenario(ch, key)
        s = j(ch, SEARCH)
        if not s:
            check("the search box is present (%s)" % key, False)
            continue
        check("the search box is present (%s)" % key, True)

        where = "row %d..%d, box %d..%d, %dpx tall" % (
            s["barTop"], s["barBottom"], s["top"], s["bottom"], s["height"])
        check("its top edge is painted by the box itself (%s)" % key,
              s["topIsInput"], where)
        check("its bottom edge is painted by the box itself (%s)" % key,
              s["bottomIsInput"], where)
        check("its row is not scrolled to hold it (%s)" % key,
              not s["overflowing"], where)
        check("it sits inside its row vertically (%s)" % key,
              s["top"] >= s["barTop"] - 1 and s["bottom"] <= s["barBottom"] + 1, where)
        check("its right edge is inside the row (%s)" % key,
              s["right"] <= s["barRight"],
              "box right=%d row right=%d" % (s["right"], s["barRight"]))


def main():
    ch = Chrome({"width": 1200, "height": 760, "mobile": False, "ua": None})
    try:
        for t in (test_thumbnails, test_context_menu, test_column_menu,
                  test_category_menu, test_search_box):
            t(ch)
            print()
    finally:
        ch.close()

    print("%d checks, %d failed" % (checks, len(failures)))
    for f in failures:
        print("  FAILED: %s" % f)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
