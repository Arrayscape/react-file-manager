import { createContext, useContext, useState } from 'react';

const OptionsContext = createContext()

// `folderTree` is whether the navigation pane is showing, and it is the only
// record of that. The component used to keep a second one -- FileManager's own
// `isNavigationPaneOpen` drew the pane and the toggle beside the trail, while
// this one drew the check in the view menu -- so a host that asked for a
// collapsed pane got a menu claiming the tree was on. Turning it off then on
// was the only way to reach the state the menu already showed.
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

// Both ways in, because a host's number is no more trustworthy than a
// slider's: the stylesheet does arithmetic on this and a tile 4000px across
// is not a view of anything.
const clampTile = (px) =>
    Math.min(TILE_MAX, Math.max(TILE_MIN, Math.round(px) || TILE_DEFAULT))

export function OptionsProvider({ children, folderTree = true, tileSize = TILE_DEFAULT }) {
    const [options, setOptions] = useState({
        statusBar: true,
        checkBox: false,
        folderTree,
        breadcrumb: true,
        tileSize: clampTile(tileSize)
    })

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