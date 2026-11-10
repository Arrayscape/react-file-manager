import { useEffect, useState } from "react"
import FolderTree from "./FolderTree"
import { getParentPath } from "../../utils/getParentPath"
import { useFiles } from "../../contexts/FilesContext"
import { useTranslation } from "../../contexts/TranslationProvider"
import "./NavigationPane.scss"

const NavigationPane = ({ onFileOpen, icons, maxDepth }) => {
    const [root, setRoot] = useState(null)
    const { files } = useFiles()
    const t = useTranslation()

    const createChildRecursive = (path, foldersStruct) => {
        if (!foldersStruct[path]) return [] // No children for this path (folder)

        return foldersStruct[path]?.map((folder) => {
            return {
                ...folder,
                subDirectories: createChildRecursive(folder.path, foldersStruct),
            }
        })
    }

    useEffect(() => {
        if (Array.isArray(files)) {
                // The top level is this tree's root, not something above it:
                // a record whose own path is '' describes where the folders
                // live and cannot be one of them. It also cannot go through
                // the grouping, because getParentPath('') is '' -- the root
                // would be its own parent and the recursion would not end.
                const folders = files.filter((file) => file.isDirectory && file.path !== "")
                // Grouping folders by parent path
                const foldersStruct = Object.groupBy(folders, ({ path }) => getParentPath(path));
                setRoot({
                    ...files.find((file) => file.path === ""),
                    path: "",
                    isRoot: true,
                    // Clicking it goes to the top level. A host's record for
                    // '' is typically not a directory -- nothing lists it --
                    // but in the tree it is the folder the others are in.
                    isDirectory: true,
                    subDirectories: createChildRecursive("", foldersStruct),
                })
        }
    }, [files])

    // Named the way the trail names it, from the same record, so one screen
    // does not call the top level two things.
    const rooted = root && { ...root, displayName: root.displayName || root.name || t("home") }

    return (
        <div className="sb-folders-list">
            {rooted?.subDirectories?.length > 0 ?
                <FolderTree
                    folder={rooted}
                    onFileOpen={onFileOpen}
                    icons={icons}
                    // The root is a level of its own, so the depth a host asks
                    // for stays the depth of its folders.
                    depth={maxDepth + 1}
                />
            :
                <div className="empty-nav-pane">{t("nothingHereYet")}</div>
            }
        </div>
    )
}

NavigationPane.displayName = "NavigationPane"

export default NavigationPane
