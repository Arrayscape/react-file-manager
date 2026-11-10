import { useState, useRef } from 'react'
import './CategoryFilter.scss'
import { ViewCategory } from './ViewCategory'

const CategoryFilter = ({ category, fontFamily, searchText, searchRegex, searchCasing, categories }) => {
    const [ showViewCategory, setShowViewCategory ] = useState(false)
    const [ preferred, setPreferred ] = useState({ left: 0, top: 0 })
    const anchorRef = useRef(null);

    // Measured when the menu opens, in viewport coordinates, because it is
    // rendered into `document.body` and positioned `fixed` -- see ViewCategory.
    //
    // It used to be told `letf={0}` (sic) and `top={30}`, with the anchor
    // arithmetic commented out just above. The misspelling meant `left`
    // arrived undefined, so nothing in JavaScript placed the menu
    // horizontally -- and two stylesheets define `.category-view`, this one
    // and HeaderSelector's, the second adding `right: 22%`. Where the menu
    // landed depended on which of those won and on whichever containing block
    // it happened to have.
    const clickCategory = () => {
        const r = anchorRef.current?.getBoundingClientRect()
        setPreferred(r ? { left: r.left, top: r.bottom + 4 } : { left: 0, top: 0 })
        setShowViewCategory(true)
    }

    return (
        <div ref={anchorRef}>
            <span className={`category-button ${category.isFilterActive && category.isFilterActive(category.key)? 'category-button-active' : ''}`}
                onClick={clickCategory}
            >
                <b>&nbsp;{category.text}&nbsp;</b>
            </span>

            {showViewCategory && 
                <ViewCategory
                    category={category}
                    searchText={searchText}
                    searchRegex={searchRegex}
                    searchCasing={searchCasing}
                    categories={categories}
                    setShowViewCategoryMenu={setShowViewCategory}
                    left={preferred.left}
                    top={preferred.top}
                />
            }

        </div>
    );

}

export default CategoryFilter
