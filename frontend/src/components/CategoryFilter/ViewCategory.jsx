import { FaCheck } from 'react-icons/fa6'
import { useDetectOutsideClick } from '../../hooks/useDetectOutsideClick'
import { useSelection } from '../../contexts/SelectionContext'
import { applyFilters } from '../../utils/filters'
import { useFileNavigation } from "../../contexts/FileNavigationContext"

const ViewCategory = ({ setShowViewCategoryMenu, left, top, searchText, searchRegex, searchCasing, categories, category }) => {
    const { selectedFiles, setSelectedFiles } = useSelection()
    const { currentFolder } = useFileNavigation()

    const viewCategoryRef = useDetectOutsideClick(() => {
        setShowViewCategoryMenu(false)
    })

    const viewCategory = category.all.map(c => { return {
        key: c.key || c.text,
        text: c.text || c.key,
        checked: category.selected.includes(c.key)
    }})

    const handleSelection = (value) => {
        setShowViewCategoryMenu(false)
        if (category.selected.includes(value))
            category.selected = category.selected.filter(x => x!==value)
        else
            category.selected.push(value)
        category.onCategoryValuesChange(category.key, value, category.selected)
        setSelectedFiles(applyFilters(selectedFiles, searchText, searchRegex, searchCasing, categories, currentFolder?.categories))
    }

    return (
        <div ref={viewCategoryRef.ref} className='category-view' role='dropdown' style={{left, top}}>
            <ul role='menu' aria-orientation='vertical'>
                {viewCategory.map((category, index) => 
                    category.key==='-'?
                        <div key={category.key} className='divider'></div>
                    :
                        <li role='menuitem' key={index} onClick={() => handleSelection(category.key)} onKeyDown={() => handleSelection(category.key)}>
                            <span>{category.checked && <FaCheck size={13} />}</span>
                            <span>{category.text}</span>
                        </li>
                )}
            </ul>
        </div>
    )
}

export { ViewCategory }
