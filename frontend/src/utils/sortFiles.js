const sortFiles = (items, sortKey = 'name', direction = 'asc', format = 'string') => {
    // Separate folders and files
    const folders = items.filter((file) => file.isDirectory);
    const files = items.filter((file) => !file.isDirectory);

    // Sort function based on key and direction
    const sortFunction = (a, b) => {
        let comparison = 0

        switch (sortKey) {
            case 'name':
                let aname = a.displayName || a.name
                let bname = b.displayName || b.name
                comparison = aname.localeCompare(bname)
                break
            
            // `data` is optional on a file, and a folder rarely carries any,
            // so every read of it is guarded. This was reachable by clicking
            // Size at a level whose rows have no metadata; a remembered sort
            // reaches it without the click, on the first render.
            case 'size':
                const sizeA = a.data?.size || 0
                const sizeB = b.data?.size || 0
                comparison = sizeA - sizeB
                break

            case 'updatedAt':
                const updatedA = a.data?.updatedAt ? new Date(a.data.updatedAt).getTime() : 0
                const updatedB = b.data?.updatedAt ? new Date(b.data.updatedAt).getTime() : 0
                comparison = updatedA - updatedB
                break

            default:
                if (typeof a.data?.[sortKey] === 'number') {
                    comparison = (a.data[sortKey] || 0) - (b.data[sortKey] || 0)
                }
                else if (typeof a.data?.[sortKey] === 'string') {
                    if (format ==='age') {
                        comparison = Date.parse(b.data[sortKey]) - Date.parse(a.data[sortKey]) 
                    }
                    else {
                        comparison = a.data[sortKey].localeCompare(b.data[sortKey])
                    }
                }
                else {
                    comparison = 0
                }
        }

        // Apply sort direction
        return direction === 'asc' ? comparison : -comparison
    }

    // Sort folders and files separately
    const sortedFolders = [...folders].sort(sortFunction)
    const sortedFiles = [...files].sort(sortFunction)

    // Always return folders first, then files
    return [...sortedFolders, ...sortedFiles]
}

export default sortFiles
