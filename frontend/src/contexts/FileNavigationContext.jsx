import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useFiles } from "./FilesContext"
import sortFiles from "../utils/sortFiles"

const FileNavigationContext = createContext()

export const DEFAULT_SORT = { key: "name", direction: "asc", format: "string" }

// Named fields, because a host that remembers the sort hands back whatever was
// in its storage. A key naming a column that no longer exists is kept rather
// than discarded -- `sortFiles` falls through to no comparison, the listing is
// in its natural order, and one click on a header puts it right.
export const normaliseSort = (given) => {
    const g = given || {}
    return {
        key: typeof g.key === "string" && g.key ? g.key : DEFAULT_SORT.key,
        direction: g.direction === "desc" ? "desc" : "asc",
        format: typeof g.format === "string" && g.format ? g.format : DEFAULT_SORT.format,
    }
}

export const FileNavigationProvider = ({ children, initialPath, initialSort, onFolderChange }) => {
    const { files } = useFiles()
    const isMountRef = useRef(false)
    const [currentPath, setCurrentPath] = useState('')
    const [currentFolder, setCurrentFolder] = useState(null)
    const [currentOwnLayoutPath, setCurrentOwnLayoutPath] = useState(null)  // we need this for handling toolbar actions on custom layouts (like 'own')
    const [currentPathFiles, setCurrentPathFiles] = useState([])
    // Read once: where the sort starts, not what the sort is.
    const [sortConfig, setSortConfig] = useState(() => normaliseSort(initialSort))

    useEffect(() => {
        if (Array.isArray(files) && files.length > 0) {
            setCurrentPathFiles(() => {
                const currPathFiles = files.filter((file) => file.path === `${currentPath}/${file.name}`)
                return sortFiles(currPathFiles, sortConfig.key, sortConfig.direction, sortConfig.format)
            })

            setCurrentFolder(() => {
                return files.find((file) => file.path === currentPath) ?? null
            })

            let file = files.find(x => x.path===currentPath)
            if (file && file.layout==='own') {
                setCurrentOwnLayoutPath(currentPath)
            }
            else {
                setCurrentOwnLayoutPath(undefined)
            }
        }
        else {
            setCurrentPathFiles([])
            setCurrentFolder(null)
        }
    }, [files, currentPath, sortConfig])

    useEffect(() => {
        if (!isMountRef.current && Array.isArray(files) && files.length > 0) {
            const activePath = files.some((file) => file.isDirectory && file.path === initialPath)?
                initialPath
                :
                ''
            setCurrentPath(activePath)
            isMountRef.current = true
        }
    }, [files]);

    return (
        <FileNavigationContext.Provider
            value={{
                currentOwnLayoutPath,
                setCurrentOwnLayoutPath,
                currentPath,
                setCurrentPath,
                currentFolder,
                setCurrentFolder,
                currentPathFiles,
                setCurrentPathFiles,
                sortConfig,
                setSortConfig,
                onFolderChange,
            }}
        >
            {children}
        </FileNavigationContext.Provider>
    )
}

export const useFileNavigation = () => useContext(FileNavigationContext)
