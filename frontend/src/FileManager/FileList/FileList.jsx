import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import FileItem from './FileItem'
import { useFileNavigation } from '../../contexts/FileNavigationContext'
import { useLayout } from '../../contexts/LayoutContext'
import { useOptions, TILE_MIN, TILE_MAX, TILE_STEP } from '../../contexts/OptionsContext'
import ContextMenu from '../../components/ContextMenu/ContextMenu'
import { useDetectOutsideClick } from '../../hooks/useDetectOutsideClick'
import useFileList from './useFileList'
import FilesHeader from './FilesHeader'
import { HeaderSelector } from '../../components/HeaderSelector/HeaderSelector'
import { useTranslation } from '../../contexts/TranslationProvider'
import { getObjectSize } from '../../utils/getObjectSize'
import './FileList.scss'
import { applySearchText, applyCategories } from '../../utils/filters'

const FileList = ({
    actions,
    space,
    spaces,
    icons,
    fontFamily,
    searchText,
    searchRegex,
    searchCasing,
    categories,
    onCreateFolder,
    onRename,
    onFileOpen,
    onRefresh,
    enableFilePreview,
    triggerAction,
    permissions,
    showContextMenu,
    formatDate,
    headersWidth,
    columnWidths,
    onHeaderChangeWidth,
    onHeaderRemove,
    onHeaderToggle,
    onHeadersReset,
    openMode
    }) => {

    const { currentPathFiles, sortConfig, setSortConfig, currentFolder } = useFileNavigation()
    const filesViewRef = useRef(null)
    const [columnSelectorPos, setColumnSelectorPos] = useState(null)
    const { activeLayout, setActiveLayout } = useLayout()
    const t = useTranslation()
    const { options, setTileSize } = useOptions()
    if (currentFolder && currentFolder.children) {
        space = currentFolder.children
    }

    const {
        emptySelecCtxItems,
        selecCtxItems,
        handleContextMenu,
        unselectFiles,
        visible,
        setVisible,
        lastSelectedFile,
        setLastSelectedFile,
        selectedFileIndexes,
        clickPosition,
        isSelectionCtx,
    } = useFileList(onRefresh, enableFilePreview, triggerAction, permissions, onFileOpen, space, spaces, openMode)

    const contextMenuRef = useDetectOutsideClick(() => setVisible(false))

    const handleSort = (key, format) => {
        let direction = 'asc'
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'
        setSortConfig({ key, direction, format })
    }

    const customActionClick = (src)=> {
        setVisible(false)
        if (actions) {
            for (let actionKey of actions.keys()) {
                let allSameClass = (selectedFileIndexes.length>0) && selectedFileIndexes.every(i => currentPathFiles[i].class===actionKey)
                if (allSameClass) {
                    for (let customAction of actions.get(actionKey)) {
                        if (customAction.title === src.target.innerText) {
                            let selectedFiles=currentPathFiles.filter ( (f,i) => selectedFileIndexes.includes(i))
                            customAction.onClick(selectedFiles)
                        }
                    }
                }
            }
        }
    }

    let contextItems = selecCtxItems
    if (actions) {
        for (let actionKey of actions.keys()) {
            let allSameClass = (selectedFileIndexes.length>0) && selectedFileIndexes.every(i => currentPathFiles[i].class===actionKey)
            if (allSameClass) {
                contextItems[contextItems.length-1].divider=true
                for (let customAction of actions.get(actionKey)) {
                    contextItems.push({
                        title:customAction.title,
                        icon:customAction.icon,
                        divider:customAction.divider,
                        onClick:customActionClick
                    })
                }
            }
        }
    }

    const renderStatusBar = () => {
        if (!options.statusBar) return <></>
        if (currentFolder && currentFolder.layout==='own' && currentFolder.children && typeof currentFolder.children === 'function') return <></>

        let list = currentPathFiles.filter (file => applySearchText(file, searchText, searchRegex, searchCasing))
        if (categories) list = list.filter(file => applyCategories(file, categories, currentFolder?.categories))
        let text = list.length + ' Items'
        if (selectedFileIndexes.length>0) {
            text+= '\u00A0\u00A0\u00A0\u00A0' + selectedFileIndexes.length +'\u00A0items selected'
            let files = list.filter ((file,i) => selectedFileIndexes.includes(i)) 
            let size = files.reduce((acc,file) => {
                return (file[spaces.get(space).sumSourceProperty]||0)+acc
            },0)
            text+= '\u00A0\u00A0\u00A0\u00A0' + getObjectSize(spaces.get(space), size)
        }

        return (
            <div className='statusbar' style={{...(!options.folderTree? {borderBottomLeftRadius: '8px'} : {})}}>
                <span className='statusbar-text'>{text}</span>
                {/* Only the grid has a tile to resize, and the slider sits at
                  * the right of the bar, where the Finder keeps it. */}
                {activeLayout === 'grid' && (
                    <input
                        type='range'
                        className='tile-size'
                        min={TILE_MIN}
                        max={TILE_MAX}
                        step={TILE_STEP}
                        value={options.tileSize}
                        title={t('tileSize')}
                        aria-label={t('tileSize')}
                        onChange={(e) => setTileSize(Number(e.target.value))}
                        // The bar is part of the chrome, not the listing: a
                        // drag across it is not a drag across files, and a
                        // click on it does not clear the selection.
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        )
    }

    if (currentFolder && currentFolder.layout==='own' && currentFolder.children && typeof currentFolder.children === 'function') {
        // render custom layout ('own')
        return (
            <div className='files own-layout' style={{paddingRight:0, height: `100%`}}>
                {currentFolder.children(currentFolder)}
            </div>
            )
    }
    else {
        // render standard layout
        return (<>
                {activeLayout === 'list' && (
                    <div className='files list header-row' style={{paddingRight:0}}>
                        <FilesHeader
                            fontFamily={fontFamily}
                            headersWidth={headersWidth}
                            onHeaderChangeWidth={onHeaderChangeWidth}
                            onHeaderRemove={onHeaderRemove}
                            onHeaderToggle={onHeaderToggle}
                            onHeadersReset={onHeadersReset}
                            onOpenColumnSelector={(el) => {
                                const r = el.getBoundingClientRect()
                                setColumnSelectorPos({ top: r.bottom, left: r.right })
                            }}
                            space={space}
                            spaces={spaces}
                            unselectFiles={unselectFiles}
                            onSort={handleSort}
                            sortConfig={sortConfig} />
                    </div>
                )}

                {/* Rendered into `document.body` rather than here.
                  *
                  * The menu is placed at the viewport coordinates of the three
                  * dots, which is what `position: fixed` wants — but a fixed
                  * element inside an ancestor carrying a `transform` is fixed
                  * to THAT ancestor's box, not to the viewport, and every
                  * animated container has one: a Bootstrap modal, an offcanvas,
                  * a card mid-transition. The menu then lands as far out as
                  * that ancestor is offset. Measured inside one: 130px below
                  * the dots and past the right edge of the window.
                  *
                  * A portal takes it out of that subtree, so the coordinates
                  * mean what they say wherever the file manager is embedded.
                  * The outside-click handler reads the DOM, not the React
                  * tree, so it still closes correctly. */}
                {columnSelectorPos && createPortal(
                    <HeaderSelector
                        setHeaderSelectorVisible={() => setColumnSelectorPos(null)}
                        onHeaderToggle={onHeaderToggle}
                        onHeadersReset={onHeadersReset}
                        space={space}
                        spaces={spaces}
                        style={{ position: 'fixed', top: columnSelectorPos.top, left: columnSelectorPos.left, transform: 'translateX(-100%)', zIndex: 9999, fontFamily }}
                    />,
                    document.body
                )}

            {/* No height here, on purpose.
              *
              * It used to be `calc(100% - 85px)` in list layout, where 85 is
              * the breadcrumb plus the column header plus the status bar,
              * counted by hand. Each of those is a box whose real height
              * depends on the host -- its font, and whether its CSS reset puts
              * padding inside the height or outside it. Count short and the
              * status bar is pushed out of the component and into the page;
              * count long and there is a gap above it.
              *
              * The column is a flex column now and this is the part that takes
              * what is left: the same arithmetic, done by the browser against
              * the heights things actually have. */}
            <div
                ref={filesViewRef}
                className={`files ${activeLayout}`}
                style={{borderBottom: (options.statusBar?1:0)}}
                onContextMenu={handleContextMenu}
                onClick={unselectFiles}
            >

                {currentPathFiles?.length > 0 ? (
                    // There is no folder record for the top level: `currentPath`
                    // starts as '' and no entry's path can match it, so
                    // `currentFolder` is null there. Gating the rows on it left
                    // the root drawing nothing at all while the status bar below
                    // went on counting the files it was not drawing.
                    //
                    // The record was only ever needed for the folder's category
                    // list, and `applyCategories` already reads a missing list
                    // as "this folder filters by nothing".
                    currentPathFiles.map((file, index) =>
                        applySearchText(file, searchText, searchRegex, searchCasing) &&
                        applyCategories(file, categories, currentFolder?.categories) &&
                        <FileItem
                            columnWidths={columnWidths}
                            key={file.name}
                            space={space}
                            spaces={spaces}
                            icons={icons}
                            index={index}
                            file={file}
                            searchText={searchText}
                            searchRegex={searchRegex}
                            searchCasing={searchCasing}
                            categories={categories}
                            onCreateFolder={onCreateFolder}
                            onRename={onRename}
                            onFileOpen={onFileOpen}
                            enableFilePreview={enableFilePreview}
                            triggerAction={triggerAction}
                            filesViewRef={filesViewRef}
                            selectedFileIndexes={selectedFileIndexes}
                            handleContextMenu={handleContextMenu}
                            setVisible={setVisible}
                            setLastSelectedFile={setLastSelectedFile}
                            draggable={permissions.move}
                            formatDate={formatDate}
                            openMode={openMode}
                        />
                    )
                )
                :
                (
                    <div className='empty-folder'>{t('folderEmpty')}</div>
                )}

                { showContextMenu && <ContextMenu
                    filesViewRef={filesViewRef}
                    contextMenuRef={contextMenuRef.ref}
                    menuItems={isSelectionCtx ? contextItems : emptySelecCtxItems}
                    visible={visible}
                    setVisible={setVisible}
                    clickPosition={clickPosition}
                />}
            </div>
            {
                renderStatusBar()
            }
        </>)

    }
}

FileList.displayName = 'FileList'

export default FileList
