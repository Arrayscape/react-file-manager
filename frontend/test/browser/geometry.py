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


# --- the chrome fits the box it is drawn in -------------------------------
# Same root as the search box, in two more places. The component's layout is
# arithmetic over fixed heights -- a 35px toolbar, `calc(100% - 46px)` for the
# middle, a 20px status bar -- and that arithmetic is written for the browser's
# own content-box. Under `box-sizing: border-box`, which every CSS reset in use
# turns on globally, each of those boxes keeps its padding inside the height
# instead of adding it, so the sums no longer come out: toolbar items overflow
# a box too short for them, and the status bar is pushed past the bottom of the
# component and out into the page.
CHROME = """(() => {
  const explorer = document.querySelector('.file-explorer');
  const toolbar = document.querySelector('.toolbar');
  const status = document.querySelector('.statusbar');
  if (!explorer || !toolbar) return null;
  const r = (el) => { const b = el.getBoundingClientRect();
    return {top: Math.round(b.top), bottom: Math.round(b.bottom),
            left: Math.round(b.left), right: Math.round(b.right),
            height: Math.round(b.height)}; };
  const items = [...toolbar.querySelectorAll('.item-action')].map((el) => {
    const b = el.getBoundingClientRect();
    return {text: el.textContent.trim(), top: Math.round(b.top),
            bottom: Math.round(b.bottom), centre: Math.round(b.top + b.height / 2)};
  });
  return {
    explorer: r(explorer), toolbar: r(toolbar),
    status: status ? r(status) : null,
    statusText: status ? status.textContent.trim() : '',
    items,
    toolbarCentre: Math.round(toolbar.getBoundingClientRect().top
                              + toolbar.getBoundingClientRect().height / 2),
  };
})()"""


def test_chrome_fits(ch):
    print("the toolbar and status bar fit the component, under a host's CSS")
    scenario(ch, "host-css")

    c = j(ch, CHROME)
    if not c or not c["items"]:
        check("the toolbar has items to measure", False)
        return
    check("the toolbar has items to measure", True)

    for it in c["items"]:
        where = "item %d..%d, toolbar %d..%d" % (
            it["top"], it["bottom"], c["toolbar"]["top"], c["toolbar"]["bottom"])
        check("'%s' is inside the toolbar" % it["text"],
              it["top"] >= c["toolbar"]["top"] - 1
              and it["bottom"] <= c["toolbar"]["bottom"] + 1, where)
        check("'%s' is vertically centred in it" % it["text"],
              abs(it["centre"] - c["toolbarCentre"]) <= 2,
              "item centre %d, toolbar centre %d" % (it["centre"], c["toolbarCentre"]))

    if not c["status"]:
        check("the status bar is present", False)
        return
    check("the status bar is present", True)
    check("the status bar is inside the component",
          c["status"]["bottom"] <= c["explorer"]["bottom"] + 1,
          "status bottom %d, component bottom %d (%r)"
          % (c["status"]["bottom"], c["explorer"]["bottom"], c["statusText"]))
    # Flush with the bottom, not merely inside it. Both failures come from the
    # same hand-counted chrome: count short and the bar is pushed out into the
    # page under the component's own rounded corner, count long and it floats
    # with a gap beneath it. Only one number is right, and it is the one the
    # browser works out.
    check("the status bar sits at the bottom of it",
          abs(c["status"]["bottom"] - c["explorer"]["bottom"]) <= 3,
          "status bottom %d, component bottom %d"
          % (c["status"]["bottom"], c["explorer"]["bottom"]))


# --- the tree and the listing are set in the same type ---------------------
# They are the same family, and were not the same size: the listing renders a
# row's name at 0.8em and the tree rendered its label at the container's full
# size. A third larger is what a different font looks like to anyone who is
# not measuring it, and both name the same folder.
TYPE = """(() => {
  const label = document.querySelector('.sb-folder-name');
  const row = document.querySelector('.file-item-container .file-name');
  if (!label || !row) return null;
  const px = (el) => parseFloat(getComputedStyle(el).fontSize);
  const fam = (el) => getComputedStyle(el).fontFamily;
  return {treeSize: px(label), rowSize: px(row), treeFamily: fam(label), rowFamily: fam(row)};
})()"""


def test_type_matches(ch):
    print("the navigation tree is set in the same type as the listing")
    scenario(ch, "host-css")

    t = j(ch, TYPE)
    if not t:
        check("there is a tree label and a row to compare", False)
        return
    check("there is a tree label and a row to compare", True)
    check("the sizes match", abs(t["treeSize"] - t["rowSize"]) < 0.6,
          "tree %.1fpx, row %.1fpx" % (t["treeSize"], t["rowSize"]))
    check("the families match", t["treeFamily"] == t["rowFamily"],
          "tree %s, row %s" % (t["treeFamily"], t["rowFamily"]))


# --- one click of the menu shows the tree ----------------------------------
# Whether the pane was open was recorded twice: FileManager's own state drew
# the pane, OptionsContext's `folderTree` drew the check in the Options menu,
# and only the first was seeded from `defaultNavExpanded`. A host asking for a
# collapsed pane therefore got a menu claiming the tree was on, and the menu's
# first click handed the pane the value the check was already showing -- so
# nothing moved. Off, then on, to get on.
#
# `.navigation-pane` is display:none when closed, which jsdom will not
# compute, so the vitest suite can only read the class name. This asks what is
# actually painted where the tree should be.
CENTRE = """(() => {
  const el = document.querySelector(%s);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  const x = Math.round(b.left + b.width / 2), y = Math.round(b.top + b.height / 2);
  const hit = b.width && b.height ? document.elementFromPoint(x, y) : null;
  return {x: x, y: y, w: Math.round(b.width), h: Math.round(b.height),
          text: el.innerText.trim().split('\\n')[0],
          painted: hit ? el.contains(hit) || hit.contains(el) : false};
})()"""

TREE_ITEM = """(() => {
  const li = [...document.querySelectorAll('li[role="menuitem"]')]
    .find(l => l.textContent.includes('Folder tree'));
  if (!li) return null;
  const b = li.getBoundingClientRect();
  return {x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
          checked: li.querySelector('span').children.length > 0};
})()"""


def centre(ch, selector):
    return j(ch, CENTRE % json.dumps(selector))


def left_click(ch, x, y):
    for t, buttons in (("mousePressed", 1), ("mouseReleased", 0)):
        ch.send("Input.dispatchMouseEvent", {"type": t, "x": x, "y": y, "button": "left",
                                             "clickCount": 1, "buttons": buttons})
    time.sleep(0.6)


def test_nav_pane_toggle(ch):
    print("one click of Options shows a tree the host asked to start collapsed")
    scenario(ch, "nav-pane")

    pane = centre(ch, ".navigation-pane")
    check("the pane starts hidden", bool(pane) and not pane["painted"],
          "%dx%d" % (pane["w"], pane["h"]) if pane else "no pane")

    opts = centre(ch, "button[title='Options']")
    if not opts:
        check("found the Options button", False)
        return
    left_click(ch, opts["x"], opts["y"])

    item = j(ch, TREE_ITEM)
    if not item:
        check("the Options menu lists Folder tree", False)
        return
    check("the Options menu lists Folder tree", True)
    check("and does not claim the tree is already on", not item["checked"])

    left_click(ch, item["x"], item["y"])

    root = centre(ch, ".sb-folders-list > .sb-folders-list-item")
    if not root:
        check("the tree is drawn after one click", False)
        return
    check("the tree is drawn after one click", root["painted"],
          "root %r, %dx%d" % (root["text"], root["w"], root["h"]))
    # The root is the top level itself, so the folders hang inside it rather
    # than sitting loose beside it -- which is what the trail already said.
    check("its root is the top level, named as the trail names it",
          root["text"] == "Library", "root label %r" % root["text"])
    inside = centre(ch, ".folder-collapsible .sb-folder-name")
    check("the folders are drawn inside that root",
          bool(inside) and inside["painted"],
          "first child %r" % (inside["text"] if inside else None))


def main():
    ch = Chrome({"width": 1200, "height": 760, "mobile": False, "ua": None})
    try:
        for t in (test_thumbnails, test_context_menu, test_column_menu,
                  test_category_menu, test_search_box, test_chrome_fits,
                  test_type_matches, test_nav_pane_toggle):
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
