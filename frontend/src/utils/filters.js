export const applySearchText = (f, searchText, searchRegex, searchCasing) => {
    if (searchText!=='' && searchText!==undefined) {
        if (searchCasing) {
            if (searchRegex) {
                try {
                    const regex=new RegExp(searchText)
                    if (!regex.test(f.name)) return false
                }
                catch { return false }
            }
            else {
                if (!f.name.includes(searchText)) return false
            }
        }
        else {
            if (searchRegex) {
                try {
                    const regex=new RegExp(searchText.toLocaleLowerCase())
                    if (!regex.test(f.name.toLocaleLowerCase())) return false
                }
                catch { 
                    return false 
                }
            }
            else {
                if (!f.name.toLocaleLowerCase().includes(searchText.toLowerCase())) return false
            }
        }
    }
    return true
}

export const applyCategories = (f, allCategories, folderCategories) => {
    if (allCategories && folderCategories) {
        // A category that reports itself inactive filters nothing.
        //
        // Without this every file in a folder that declares a category is put
        // to `onCategoryFilter` even when the user has chosen no value for it,
        // and the honest answer to "does this file match the empty selection?"
        // is no — so the folder renders as empty. `isFilterActive` is already
        // part of the category: it is what decides whether the filter button
        // is drawn as active. It decides this too now.
        //
        // A category that does not provide one behaves exactly as before.
        let applicableCategories = allCategories
            .filter(c => folderCategories.includes(c.key))
            .filter(c => !c.isFilterActive || c.isFilterActive(c.key))
        let valid=true
        for (let c of applicableCategories) {
            valid = valid && c.onCategoryFilter(c.key, f)
            if (!valid) return false
        }
    }
    return true
}

export const applyFilters = (files, searchText, searchRegex, searchCasing, categories, folderCategories) => {
    if (searchText!=='' && searchText!==undefined) {
        files = files.filter(f => applySearchText(f, searchText, searchRegex, searchCasing))
    }
    if (categories && folderCategories) {
        files = files.filter(f => applyCategories(f, categories, folderCategories))
    }
    return files
}
