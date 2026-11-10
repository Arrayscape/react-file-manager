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

    // Focus returns where it came from when the search box goes away.
    //
    // This effect also used to register a `keydown` listener on `window` in
    // the CAPTURE phase which called `stopPropagation()` on every event,
    // unconditionally, for as long as this component was mounted. Capture on
    // window is the first thing to see a key, so stopping it there meant no
    // key reached any element at all: not the file list, not the host
    // application, and not the New Folder or Rename editors, whose Enter and
    // Escape handling consequently never ran once.
    //
    // The intent was sound -- typing in search should not fire the shortcuts
    // `useKeyPress` watches for -- but those are registered on window in the
    // BUBBLE phase, so the way to keep them quiet is to stop the event on the
    // input itself on its way up. That is the `onKeyDown` on the input below,
    // and it withholds keys from exactly that one listener rather than from
    // the entire document.
    useEffect(() => {
        const previousFocus = document.activeElement
        return () => {
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
                // Keys typed here are for this box, not for the file list's
                // shortcuts: `useKeyPress` listens on window as the event
                // bubbles, so stopping it here is enough to keep it quiet,
                // and every other element keeps its keyboard.
                onKeyDown={(e) => e.stopPropagation()}
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
