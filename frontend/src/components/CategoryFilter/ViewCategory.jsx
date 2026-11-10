import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

    // `left` and `top` are where the button would like the menu; this is where
    // it fits. Measured after mount, like ContextMenu does, because the menu's
    // own size is what decides whether the preferred spot leaves it hanging
    // off the edge -- and the room to fall back on is the room on screen, not
    // the room inside whatever pane the button lives in.
    const [place, setPlace] = useState({ left, top })

    useEffect(() => {
        const el = viewCategoryRef.ref.current
        if (!el) return
        const b = el.getBoundingClientRect()
        const margin = 8
        const clamp = (v, size, limit) => Math.max(margin, Math.min(v, limit - size - margin))
        setPlace({
            left: clamp(left, b.width, window.innerWidth),
            // Above the button instead of below, when below would not fit.
            top: top + b.height + margin > window.innerHeight
                ? Math.max(margin, top - b.height - margin)
                : top,
        })
    }, [left, top])

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

    // Into `document.body`, for the same two reasons as the other two menus.
    //
    // `.category-view` is styled by two stylesheets -- this component's and
    // HeaderSelector's -- so inline `position: fixed` with explicit
    // coordinates is the only placement that does not depend on which rule
    // won. And `fixed` inside an ancestor carrying a `transform` is fixed to
    // that ancestor rather than the window, which is every modal and
    // offcanvas, and is where this menu will live when the library opens as
    // one.
    //
    // The outside-click handler that closes it reads the DOM rather than the
    // React tree, so it is unaffected.
    return createPortal(
        <div ref={viewCategoryRef.ref} className='category-view' role='dropdown'
            style={{ position: 'fixed', left: place.left, top: place.top, zIndex: 9999 }}>
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
        </div>,
        document.body,
    )
}

export { ViewCategory }
