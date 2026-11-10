import { createContext, useContext, useState } from 'react';

const OptionsContext = createContext()

// How big a tile is in the grid, as the edge of its picture in CSS pixels.
// The slider in the status bar moves it, the way the Finder's does.
//
// TILE_MAX is where a host's thumbnail runs out. The picture handed to a tile
// is a fixed-size rendering -- the dashboard's is 320px across -- and a retina
// screen draws two device pixels for every CSS one, so past about 160 the
// browser is enlarging a picture rather than showing it.
export const TILE_MIN = 32
export const TILE_MAX = 160
export const TILE_STEP = 8
export const TILE_DEFAULT = 48

// Every way in is clamped, because a host's number is no more trustworthy
// than a slider's -- and a host that restores what a person left behind is
// handing back whatever was in storage. The stylesheet does arithmetic on
// this, and a tile 4000px across is not a view of anything.
const clampTile = (px) =>
    Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(px) || TILE_DEFAULT))

// What the view menu turns on and off, and what the slider moves.
//
// `folderTree` is whether the navigation pane is showing, and it is the only
// record of that. The component used to keep a second one -- FileManager's own
// `isNavigationPaneOpen` drew the pane and the toggle beside the trail, while
// this one drew the check in the view menu -- so a host that asked for a
// collapsed pane got a menu claiming the tree was on. Turning it off then on
// was the only way to reach the state the menu already showed.
export const DEFAULT_VIEW_OPTIONS = {
    statusBar: true,
    checkBox: false,
    folderTree: true,
    breadcrumb: true,
    tileSize: TILE_DEFAULT,
}

// Named keys rather than a spread, so what a host hands back is read as data:
// an old record, a record from a different component, or whatever a person
// edited into their own storage can only supply these five, and each one of
// them is checked.
export const normaliseViewOptions = (given) => {
    const g = given || {}
    const flag = (v, d) => (typeof v === 'boolean' ? v : d)
    return {
        statusBar: flag(g.statusBar, DEFAULT_VIEW_OPTIONS.statusBar),
        checkBox: flag(g.checkBox, DEFAULT_VIEW_OPTIONS.checkBox),
        folderTree: flag(g.folderTree, DEFAULT_VIEW_OPTIONS.folderTree),
        breadcrumb: flag(g.breadcrumb, DEFAULT_VIEW_OPTIONS.breadcrumb),
        tileSize: clampTile(g.tileSize ?? DEFAULT_VIEW_OPTIONS.tileSize),
    }
}

// The columns of every space a person has touched:
//
//     { [spaceName]: { [columnName]: { width?: number, hidden?: boolean } } }
//
// Two levels of a host's stored record, so two levels of checking. A width is
// a pixel count the header hands straight to a style, and a string or a
// negative number there is a broken layout rather than a wrong one.
export const normaliseColumns = (given) => {
    if (!given || typeof given !== 'object') return {}
    const out = {}
    for (const [spaceName, cols] of Object.entries(given)) {
        if (!cols || typeof cols !== 'object') continue
        const kept = {}
        for (const [name, col] of Object.entries(cols)) {
            if (!col || typeof col !== 'object') continue
            const entry = {}
            if (Number.isFinite(col.width) && col.width > 0) entry.width = Math.round(col.width)
            if (typeof col.hidden === 'boolean') entry.hidden = col.hidden
            if (Object.keys(entry).length) kept[name] = entry
        }
        if (Object.keys(kept).length) out[spaceName] = kept
    }
    return out
}

// Changes are reported by FileManagerBody rather than from here, because the
// record a host stores is wider than this context: the sort lives in the
// navigation context and the column widths in the component itself. One place
// assembles all of it, so a host is told the whole view or nothing.
export function OptionsProvider({ children, initial }) {
    // Read once. A host that saves these will pass back what it was last
    // told, and re-seeding from a prop would undo the change that caused the
    // save -- so this is where the view starts, not what the view is.
    const [options, setOptions] = useState(() => normaliseViewOptions(initial))

    const toggleStatusBar = () => setOptions(prev => ({ ...prev, statusBar: !prev.statusBar }))
    const toggleFolderTree = () => setOptions(prev => ({ ...prev, folderTree: !prev.folderTree }))
    const toggleCheckBox = () => setOptions(prev => ({ ...prev, checkBox: !prev.checkBox }))
    const toggleBreadcrumb = () => setOptions(prev => ({ ...prev, breadcrumb: !prev.breadcrumb }))
    const setTileSize = (px) => setOptions(prev => ({ ...prev, tileSize: clampTile(px) }))

    return (
        <OptionsContext.Provider value={{ options, toggleStatusBar, toggleFolderTree, toggleCheckBox, toggleBreadcrumb, setTileSize }}>
            {children}
        </OptionsContext.Provider>
    )
}

export function useOptions() {
    const context = useContext(OptionsContext);
    if (!context) {
        throw new Error('useOptions must be included inside a <OptionsProvider>')
    }
    return context
}