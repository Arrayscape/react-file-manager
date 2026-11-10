// The fixture app: one panel per thing we fixed or added.
//
// Why it exists. Every one of our patches was found and verified against a
// throwaway harness that lived in a scratch directory and died with the
// session, which meant the next person had nothing to look at and no way to
// check a regression. These are the same scenarios, committed.
//
// Two audiences. A person runs `npm run dev` and opens /dev/ to click through
// them. The browser tests in test/browser/ open one directly by its key --
// /dev/?scenario=context-menu -- and measure it, because jsdom cannot:
// getBoundingClientRect is all zeroes there, and three of our fixes are about
// where an element lands.
//
// Separate from src/main.jsx on purpose. That file is upstream's demo, and
// keeping out of it means a merge from upstream touches nothing of ours.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { FileManager } from '../src/index.js'
import { assets, ROOT, SPACES, ASSET_SPACE, TRANSFORM_SPACE, ICONS, ALL_PERMISSIONS, swatch } from './fixtures.jsx'

const base = {
    files: assets,
    spaces: SPACES,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
    height: '420px',
}

/** A category nobody has chosen a value for.
 *
 *  The bug: every file in a folder declaring a category was put to
 *  `onCategoryFilter` even with nothing selected, and the honest answer to
 *  "does this match the empty selection?" is no -- so the folder rendered
 *  empty while the status bar underneath counted the files it was not
 *  drawing. `isFilterActive` already decides whether the filter button looks
 *  active; it decides this too now.
 */
function CategoriesScenario() {
    const [selected, setSelected] = React.useState([])
    const categories = [
        {
            key: 'usage',
            text: 'Usage',
            all: [
                { key: 'used', text: 'Used' },
                { key: 'unused', text: 'Unused' },
            ],
            selected,
            onCategoryValuesChange: (_key, _value, next) => setSelected(next),
            onCategoryFilter: (_key, f) => selected.includes(f.data?.usage ?? 'unused'),
            isFilterActive: () => selected.length > 0,
        },
    ]
    const files = assets.map((f) => ({ ...f, categories: ['usage'] }))
    return <FileManager {...base} files={files} categories={categories} />
}

/** A host whose CSS resets the box model and form controls -- nearly all of
 *  them: Bootstrap, Tailwind, normalize and every variant of those.
 *
 *  Two resets, and the bug needs both:
 *
 *    - `box-sizing: border-box` on everything. The breadcrumb row asks for
 *      `height: 22px` with 6px of padding above and below, which is 34px of
 *      room under the browser's own content-box and 22px under this one. The
 *      row keeps clipping at the same place either way; there is just 12px
 *      less of it.
 *    - `font-size: inherit` on input, because the browser's default for form
 *      controls is 13.33px Arial and that looks nothing like the rest of the
 *      page. Our CSS gives the search box a font family and leaves its size to
 *      the browser, so here the box is as tall as the page's text.
 *
 *  A ~27px box in a 22px row, and the row scrolls rather than grows, so the
 *  bottom of the search box is not painted at all. The other scenarios cannot
 *  show this: at 13.33px in a 34px row it fits twice over.
 *
 *  It carries the rest of a real host's chrome for the same reason -- a
 *  toolbar with items in it, the trail turned on, a category filter and a
 *  status bar. Every one of those is a box whose height the layout used to
 *  count by hand, and a count is only ever right for the page it was counted
 *  on.
 */
/** A toolbar to measure. The shipped fixtures carry no leftItems, so without
 *  these the toolbar is empty and says nothing about how it lays out. */
const HOST_SPACES = new Map([
    ['filedata', { ...ASSET_SPACE, leftItems: [{ name: 'upload', text: 'Upload', onClick: () => {} }] }],
    ['folder', { ...ASSET_SPACE, leftItems: [{ name: 'upload', text: 'Upload', onClick: () => {} }] }],
    ['asset', { ...ASSET_SPACE, leftItems: [{ name: 'download', text: 'Download', onClick: () => {} }] }],
    ['transform', TRANSFORM_SPACE],
])

function HostCssScenario() {
    const [selected, setSelected] = React.useState([])
    const categories = [
        {
            key: 'usage',
            text: 'Usage',
            all: [
                { key: 'used', text: 'Used' },
                { key: 'unused', text: 'Unused' },
            ],
            selected,
            onCategoryValuesChange: (_key, _value, next) => setSelected(next),
            onCategoryFilter: (_key, f) => selected.includes(f.data?.usage ?? 'unused'),
            isFilterActive: () => selected.length > 0,
        },
    ]
    const files = assets.map((f) => ({ ...f, categories: ['usage'] }))

    return (
        <>
            <style>{`
                #scenario, #scenario *, #scenario *::before, #scenario *::after {
                    box-sizing: border-box;
                }
                #scenario { font-size: 16px; }
                #scenario input { font-family: inherit; font-size: inherit; line-height: 1.5; }
            `}</style>
            <FileManager
                {...base}
                files={files}
                categories={categories}
                spaces={HOST_SPACES}
                initialPath="/Event photos"
                showBreadcrumb
            />
        </>
    )
}

const SCENARIOS = [
    {
        key: 'assets',
        title: 'An asset and its transforms',
        note: 'The realistic shape: a folder named after the file, holding original.jpg and what is derived from it. Open /Event photos/crowd-2026.jpg.',
        render: () => <FileManager {...base} initialPath="/Event photos" />,
    },
    {
        key: 'root',
        title: 'The top level draws its contents',
        note: 'Rendered without any record at path ’’, which is the case that breaks: currentFolder is null there, and gating rows on it left this empty while the status bar counted the files it was not drawing. Supplying a fake non-directory entry at ’’ hides the bug, so this scenario deliberately does not.',
        render: () => <FileManager {...base} files={base.files.filter((f) => f.path !== '')} />,
    },
    {
        key: 'categories',
        title: 'A category with nothing selected hides nothing',
        note: 'Every row should be listed until you pick a value. Unpatched, the list is empty and the status bar says otherwise.',
        render: () => <CategoriesScenario />,
    },
    {
        key: 'context-menu',
        title: 'Right-click menu near the bottom edge',
        note: 'Right-click the last row. The menu used to be positioned inside the scrolling pane, which clips, so it was cut off exactly when it mattered.',
        render: () => (
            <FileManager {...base} initialPath="/Event photos/crowd-2026.jpg" height="190px" />
        ),
    },
    {
        key: 'column-menu',
        title: 'Column menu inside a transformed ancestor',
        note: 'The wrapper carries a transform, as every modal and offcanvas does. `position: fixed` inside one is fixed to that ancestor, not the window, so the menu landed far from the three dots.',
        render: () => (
            <div style={{ transform: 'translateY(40px) translateX(24px)' }}>
                <FileManager {...base} />
            </div>
        ),
    },
    {
        key: 'category-menu',
        title: 'Category menu inside a transformed ancestor',
        note: 'Click Usage. The menu was told `letf={0}` (sic), so left arrived undefined and only the cascade placed it — and two stylesheets define .category-view. The wrapper carries a transform, as a modal does, which is where this menu will live when the library opens as one.',
        render: () => (
            <div style={{ transform: 'translateY(40px) translateX(24px)' }}>
                <CategoriesScenario />
            </div>
        ),
    },
    {
        key: 'thumbnails',
        title: 'Per-file thumbnails, and the fallback beside them',
        note: 'crowd-2026.jpg and its transforms carry a picture; terms.pdf and mystery.bin do not and keep their class icon. Switch to grid, where columns do not exist and only this can show a picture.',
        render: () => <FileManager {...base} initialPath="/Event photos" />,
    },
    {
        key: 'permissions',
        title: 'Withheld actions are not offered',
        note: 'create and upload are false, so New Folder and Upload should be absent rather than present and inert.',
        render: () => (
            <FileManager
                {...base}
                permissions={{ ...ALL_PERMISSIONS, create: false, upload: false }}
            />
        ),
    },
    {
        key: 'host-css',
        title: 'The search box under a host that resets form controls',
        note: 'Bootstrap and friends set font-size: inherit on input. The breadcrumb row was pinned to 22px with overflow-x: hidden -- which makes the other axis scroll -- so a box taller than 22px had its bottom cut off. The default scenarios cannot show this: at the browser default of 13.33px the box fits.',
        render: () => <HostCssScenario />,
    },
    {
        key: 'selection',
        title: 'Cmd-click extends a selection',
        note: 'On macOS the add-to-selection modifier is Cmd. Reading ctrlKey alone left Mac users no way to extend a selection at all.',
        render: () => <FileManager {...base} initialPath="/Event photos" />,
    },
]

function App() {
    const key = new URLSearchParams(location.search).get('scenario')
    const chosen = SCENARIOS.find((s) => s.key === key)

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 1100 }}>
            <nav style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.9 }}>
                {SCENARIOS.map((s) => (
                    <a
                        key={s.key}
                        href={`?scenario=${s.key}`}
                        style={{
                            marginRight: 10,
                            padding: '2px 8px',
                            borderRadius: 4,
                            textDecoration: 'none',
                            border: '1px solid #ccc',
                            color: s.key === key ? '#fff' : '#333',
                            background: s.key === key ? '#3b6ea8' : '#f6f6f6',
                        }}
                    >
                        {s.key}
                    </a>
                ))}
            </nav>

            {chosen ? (
                <>
                    <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>{chosen.title}</h2>
                    <p style={{ color: '#555', fontSize: 13, margin: '0 0 14px', maxWidth: 760 }}>
                        {chosen.note}
                    </p>
                    <div id="scenario">{chosen.render()}</div>
                </>
            ) : (
                <p style={{ color: '#555', fontSize: 14 }}>
                    Pick a scenario above, or open one directly as{' '}
                    <code>/dev/?scenario=&lt;key&gt;</code>.
                </p>
            )}
        </div>
    )
}

createRoot(document.getElementById('root')).render(<App />)
