import { createContext, useContext, useState } from 'react';

const OptionsContext = createContext()

// `folderTree` is whether the navigation pane is showing, and it is the only
// record of that. The component used to keep a second one -- FileManager's own
// `isNavigationPaneOpen` drew the pane and the toggle beside the trail, while
// this one drew the check in the view menu -- so a host that asked for a
// collapsed pane got a menu claiming the tree was on. Turning it off then on
// was the only way to reach the state the menu already showed.
export function OptionsProvider({ children, folderTree = true }) {
    const [options, setOptions] = useState({
        statusBar: true,
        checkBox: false,
        folderTree,
        breadcrumb: true
    })

    const toggleStatusBar = () => setOptions(prev => ({ ...prev, statusBar: !prev.statusBar }))
    const toggleFolderTree = () => setOptions(prev => ({ ...prev, folderTree: !prev.folderTree }))
    const toggleCheckBox = () => setOptions(prev => ({ ...prev, checkBox: !prev.checkBox }))
    const toggleBreadcrumb = () => setOptions(prev => ({ ...prev, breadcrumb: !prev.breadcrumb }))

    return (
        <OptionsContext.Provider value={{ options, toggleStatusBar, toggleFolderTree, toggleCheckBox, toggleBreadcrumb }}>
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