import { useRef, useState, useEffect } from 'react'
import { useFileNavigation } from '../../contexts/FileNavigationContext'
import { useSelection } from '../../contexts/SelectionContext'
import { applyFilters } from '../../utils/filters'
import './SearchInput.scss'

const SearchInput = ({ onSearchFilterChange, searchText, searchRegex, searchCasing, categories }) => {
    const inputRef = useRef(null)
    const [filterRegex, setFilterRegex] = useState(false)
    const [filterCasing, setFilterCasing] = useState(false)
    const { selectedFiles, setSelectedFiles } = useSelection()
    const { currentFolder } = useFileNavigation()

    useEffect(() => {
        const previousFocus = document.activeElement

        const handleKeyDown = (event) => {
            event.stopPropagation()
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true)
            previousFocus?.focus()
        }
    }, [])

    const clickRegex = () => {
        const next = !filterRegex
        onSearchFilterChange(inputRef.current.value, next, filterCasing)
        setFilterRegex(next)
        setSelectedFiles(applyFilters(selectedFiles, inputRef.current.value, next, filterCasing, categories, currentFolder?.categories))
    }

    const clickCasing = () => {
        const next = !filterCasing
        onSearchFilterChange(inputRef.current.value, filterRegex, next)
        setFilterCasing(next)
        setSelectedFiles(applyFilters(selectedFiles, inputRef.current.value, filterRegex, next, categories, currentFolder?.categories))
    }

    const paddingRight = (searchRegex && searchCasing) ? '52px' : (searchRegex || searchCasing) ? '30px' : '22px'
    const btnStyle = (active) => ({
        border: `1px solid ${active ? 'currentColor' : 'rgba(128,128,128,0.4)'}`,
        borderRadius: '3px',
        backgroundColor: active ? 'rgba(128,128,128,0.25)' : 'transparent',
        color: 'inherit',
        position: 'absolute',
        top: '50%',
        width: '18px',
        height: '18px',
        fontSize: '9px',
        lineHeight: '18px',
        textAlign: 'center',
        transform: 'translateY(-55%)',
        cursor: 'pointer',
        userSelect: 'none',
    })

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <input
                ref={inputRef}
                placeholder='Search...'
                defaultValue={searchText}
                className='search-input'
                style={{ paddingRight }}
                onFocus={(e) => e.target.placeholder = ""}
                onBlur={(e) => { e.target.placeholder = 'Search...' }}
                onKeyUp={(e) => {
                    if (e.key === 'Escape') {
                        onSearchFilterChange('', false, false)
                        setFilterRegex(false)
                        setFilterCasing(false)
                        setSelectedFiles(applyFilters(selectedFiles, '', false, false, categories, currentFolder?.categories))
                        if (inputRef.current) {
                            inputRef.current.value = ''
                            inputRef.current.placeholder = 'Search...'
                            inputRef.current.blur()
                        }
                    }
                    else {
                        onSearchFilterChange(inputRef.current.value, filterRegex, filterCasing)
                        setSelectedFiles(applyFilters(selectedFiles, inputRef.current.value, filterRegex, filterCasing, categories, currentFolder?.categories))
                    }
                }}
            />
            { !searchRegex && !searchCasing &&
                <svg
                    width="16" height="16" fill="none" stroke="#888" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"
                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-55%)', pointerEvents: 'none' }}
                >
                    <circle cx="11" cy="11" r="6" />
                    <line x1="21" y1="21" x2="14.65" y2="14.65" />
                </svg>
            }
            { searchRegex &&
                <span style={{ ...btnStyle(filterRegex), right: searchCasing ? '28px' : '6px' }} onClick={clickRegex}><b>.*</b></span>
            }
            { searchCasing &&
                <span style={{ ...btnStyle(filterCasing), right: '6px' }} onClick={clickCasing}><b>aA</b></span>
            }
        </div>
    )
}

export default SearchInput
