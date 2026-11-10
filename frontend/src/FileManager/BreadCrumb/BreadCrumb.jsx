import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { MdHome, MdMoreHoriz, MdOutlineNavigateNext } from 'react-icons/md'
import { TbLayoutSidebarLeftExpand, TbLayoutSidebarLeftCollapseFilled } from 'react-icons/tb'
import { useFileNavigation } from '../../contexts/FileNavigationContext'
import { useFiles } from '../../contexts/FilesContext'
import { useDetectOutsideClick } from '../../hooks/useDetectOutsideClick'
import { useTranslation } from '../../contexts/TranslationProvider'
import { useLayout } from '../../contexts/LayoutContext'
import './BreadCrumb.scss'
import SearchInput from '../../components/SearchInput/SearchInput'
import CategoryFilter from '../../components/CategoryFilter/CategoryFilter'
import { useOptions } from '../../contexts/OptionsContext'

const BreadCrumb = ({ collapsibleNav, isNavigationPaneOpen, onNavigationPaneChange, onSearchFilterChange, searchMode, searchText, searchRegex, searchCasing, categories, fontFamily, showBreadcrumb }) => {
    const [folders, setFolders] = useState([])
    const [hiddenFolders, setHiddenFolders] = useState([])
    const [hiddenFoldersWidth, setHiddenFoldersWidth] = useState([])
    const [showHiddenFolders, setShowHiddenFolders] = useState(false)
    const { currentPathFiles, currentPath, setCurrentPath, onFolderChange, currentFolder } = useFileNavigation()
    const { files } = useFiles()
    const breadCrumbRef = useRef(null)
    const foldersRef = useRef([])
    const moreBtnRef = useRef(null)
    const popoverRef = useDetectOutsideClick(() => {
        setShowHiddenFolders(false)
    })
    const t = useTranslation()
    const navTogglerRef = useRef(null)
    const { activeLayout } = useLayout()
    const { options } = useOptions()

    useEffect(() => {
        setFolders(() => {
            let path = ''
            return currentPath?.split('/').map((item) => {
                const itemPath = item === '' ? item : (path += `/${item}`)
                // A segment of the path is not always what the folder is
                // called. A host whose paths are ids -- which is any host
                // where two folders can share a name -- puts the readable one
                // in `displayName`, and both the file list and the navigation
                // pane show it. The trail showed the id, so the one thing on
                // screen whose job is saying where you are said it in a
                // language nobody reads.
                const file = files?.find((f) => f.path === itemPath)
                return {
                    name: file?.displayName || item || t('home'),
                    path: itemPath,
                }
            })
        })
        setHiddenFolders([])
        setHiddenFoldersWidth([])
    }, [currentPath, t, files])

    const switchPath = (path) => {
        setCurrentPath(path)
        onFolderChange?.(path)
    }

    const getBreadCrumbWidth = () => {
        const containerWidth = breadCrumbRef.current.clientWidth
        const containerStyles = getComputedStyle(breadCrumbRef.current)
        const paddingLeft = parseFloat(containerStyles.paddingLeft)
        const navTogglerGap = collapsibleNav ? 2 : 0
        const navTogglerDividerWidth = 1
        const navTogglerWidth = collapsibleNav? navTogglerRef.current?.clientWidth + navTogglerDividerWidth : 0
        const moreBtnGap = hiddenFolders.length > 0 ? 1 : 0
        const flexGap = parseFloat(containerStyles.gap) * (folders.length + moreBtnGap + navTogglerGap)
        return containerWidth - (paddingLeft + flexGap + navTogglerWidth)
    }

    const checkAvailableSpace = () => {
        const availableSpace = getBreadCrumbWidth() - 200    // witdh of search input
        const remainingFoldersWidth = foldersRef.current.reduce((prev, curr) => {
            if (!curr) return prev
            return prev + curr.clientWidth
        }, 0)
        const moreBtnWidth = moreBtnRef.current?.clientWidth || 0
        return availableSpace - (remainingFoldersWidth + moreBtnWidth)
    }

    const isBreadCrumbOverflowing = () => {
        if (!breadCrumbRef.current) return false
        return breadCrumbRef.current.scrollWidth > breadCrumbRef.current.clientWidth
    }

    useEffect(() => {
        if (isBreadCrumbOverflowing()) {
            const hiddenFolder = folders[1]
            const hiddenFolderWidth = foldersRef.current[1]?.clientWidth
            setHiddenFoldersWidth((prev) => [...prev, hiddenFolderWidth])
            setHiddenFolders((prev) => [...prev, hiddenFolder])
            setFolders((prev) => prev.filter((_, index) => index !== 1))
        }
        else if (hiddenFolders.length > 0 && checkAvailableSpace() > hiddenFoldersWidth.at(-1)) {
            const newFolders = [folders[0], hiddenFolders.at(-1), ...folders.slice(1)]
            setFolders(newFolders)
            setHiddenFolders((prev) => prev.slice(0, -1))
            setHiddenFoldersWidth((prev) => prev.slice(0, -1))
        }
    }, [isBreadCrumbOverflowing])

    if (currentFolder && currentFolder.layout==='own' && currentFolder.children && typeof currentFolder.children === 'function') {
        return <></>
    }

    return (
        <div className='bread-crumb-container' style={{...(activeLayout==='grid'?{borderBottom:1, borderBottomStyle:'solid', borderBottomColor:'#cfcfcf'}:{})}}>
            <div className='breadcrumb' ref={breadCrumbRef}>
                {collapsibleNav && (<>
                    <div
                        ref={navTogglerRef}
                        className='nav-toggler'
                        title={`${isNavigationPaneOpen ? t('collapseNavigationPane') : t('expandNavigationPane')}`}
                    >
                        <span
                          className='folder-name folder-name-btn'
                          onClick={() => onNavigationPaneChange()}
                        >
                          {isNavigationPaneOpen ? (
                              <TbLayoutSidebarLeftCollapseFilled />
                          ) : (
                              <TbLayoutSidebarLeftExpand />
                          )}
                        </span>
                    </div>
                    <div className='divider' />
                    </>)
                }

                { ((options.breadcrumb || currentFolder?.features?.includes('breadcrumb')) && showBreadcrumb) && folders.map((folder, index) => (
                    <div key={index} style={{ display: 'contents' }}>
                        <span
                            className='folder-name'
                            onClick={() => switchPath(folder.path)}
                            ref={(el) => (foldersRef.current[index] = el)}
                        >
                            {index === 0 ? <MdHome /> : <MdOutlineNavigateNext />}
                            {folder.name}
                        </span>
                        {hiddenFolders?.length > 0 && index === 0 && (
                            <button
                                    className='folder-name folder-name-btn'
                                    onClick={() => setShowHiddenFolders(true)}
                                    ref={moreBtnRef}
                                    title={t('showMoreFolder')}
                                >
                                <MdMoreHoriz size={22} className='hidden-folders' />
                            </button>
                        )}
                    </div>
                ))}

                <span style={{flexGrow: 1, flexShrink: 1, minWidth: 0}}></span>

                {
                    categories!==undefined  &&
                    (currentPathFiles.length>0) &&
                    categories.filter(c => currentFolder?.categories?.includes(c.key)).map( (c,index) => 
                        <CategoryFilter
                            key={index}
                            category={c}
                            fontFamily={fontFamily}
                            searchText={searchText}
                            searchRegex={searchRegex}
                            searchCasing={searchCasing}
                            categories={categories}
                        />
                    )
                }

                {
                    ((searchMode==='auto' && currentPathFiles.length>0)||searchMode==='visible') &&
                    <SearchInput onSearchFilterChange={onSearchFilterChange} searchText={searchText} searchRegex={searchRegex} searchCasing={searchCasing} categories={categories}/>
                }
            </div>

            {showHiddenFolders && (
            <ul ref={popoverRef.ref} className='hidden-folders-container'>
                {hiddenFolders.map((folder, index) => (
                <li
                    key={index}
                    onClick={() => {
                    switchPath(folder.path)
                    setShowHiddenFolders(false)
                    }}
                >
                    {folder?.name}
                </li>
                ))}
            </ul>
            )}
        </div>
    )
}

BreadCrumb.displayName = 'BreadCrumb'

BreadCrumb.propTypes = {
    isNavigationPaneOpen: PropTypes.bool.isRequired,
    onNavigationPaneChange: PropTypes.func.isRequired,
    onSearchFilterChange: PropTypes.func.isRequired,
    collapsibleNav: PropTypes.bool,
    searchMode: PropTypes.string.isRequired,
    searchText: PropTypes.string,
    searchRegex: PropTypes.bool,
    searchCasing: PropTypes.bool,
    fontFamily: PropTypes.string.isRequired,
    showBreadcrumb: PropTypes.bool.isRequired
}

export default BreadCrumb