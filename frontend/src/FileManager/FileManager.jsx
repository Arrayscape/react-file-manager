import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import Loader from '../components/Loader/Loader'
import Toolbar from './Toolbar/Toolbar'
import NavigationPane from './NavigationPane/NavigationPane'
import BreadCrumb from './BreadCrumb/BreadCrumb'
import FileList from './FileList/FileList'
import Actions from './Actions/Actions'
import { OptionsProvider, useOptions, normaliseColumns } from '../contexts/OptionsContext'
import { FilesProvider } from '../contexts/FilesContext'
import { FileNavigationProvider, useFileNavigation } from '../contexts/FileNavigationContext'
import { SelectionProvider } from '../contexts/SelectionContext'
import { ClipBoardProvider } from '../contexts/ClipboardContext'
import { LayoutProvider } from '../contexts/LayoutContext'
import { useTriggerAction } from '../hooks/useTriggerAction'
import { useColumnResize } from '../hooks/useColumnResize'
import { dateStringValidator, urlValidator } from '../validators/propValidators'
import { TranslationProvider } from '../contexts/TranslationProvider'
import { Backdrop } from './Backdrop'
import { defaultPermissions } from '../constants'
import { formatDate as defaultFormatDate } from '../utils/formatDate'
import PropTypes from 'prop-types'
import './FileManager.scss'

const RefHandler = forwardRef((props, ref) => {
    useImperativeHandle(ref, () => ({
        changeFolder: (path) => {
            props.onNavigate(path)
        },
        lock: () => {
            props.lock()
        },
        unlock: () => {
            props.unlock()
        }
    }))
    return null
})

const FileManagerBody = ({ props, innerRef }) => {
    const {
        actions,
        space: initialSpace,
        spaces: initialSpaces,
        rightItems,
        files,
        fileUploadConfig,
        fileDownloadConfig,
        icons,
        isLoading,
        onCreateFolder,
        onFileUploading = () => { },
        onFileUploaded = () => { },
        onFileUploadError = () => { },
        onCut,
        onCopy,
        onPaste,
        onRename,
        onDownload,
        onDelete = () => null,
        onLayoutChange = () => { },
        onRefresh,
        onFileOpen = () => { },
        onFolderChange = () => { },
        onSelect,
        onSelectionChange,
        onError = () => { },
        layout = 'grid',
        enableFilePreview = true,
        maxFileSize,
        filePreviewPath,
        acceptedFileTypes,
        height = '600px',
        width = '100%',
        initialPath = '',
        filePreviewComponent,
        primaryColor = '#6155b4',
        fontFamily = 'Nunito Sans, sans-serif',
        // Undefined by default, so the stylesheet's own 16px stands. A host
        // that passes one gets the whole component on its own scale.
        fontSize,
        language = 'en-US',
        permissions: userPermissions = {},
        collapsibleNav = false,
        viewOptions,
        onViewOptionsChange,
        className = '',
        style = {},
        searchMode = 'auto',
        searchRegex = false,
        searchCasing = false,
        openMode = 'default',  // none 
        showRefresh = true,
        showContextMenu = true,
        categories = undefined,
        showBreadcrumb = false,
        maxNavigationPaneLevel = 2,
        minFileActionsLevel = 1,
        formatDate = defaultFormatDate
    } = props

    const { setCurrentPath, currentFolder, sortConfig } = useFileNavigation()
    const [srchText, setSrchText] = useState('')
    const [srchRegex, setSrchRegex] = useState(false)
    const [srchCasing, setSrchCasing] = useState(false)
    const [isLocked, setIsLocked] = useState(false)
    // Whether the navigation pane is showing lives in the options, beside the
    // other three things the view menu turns on and off, because the menu's
    // check and the pane have to be the same fact. `defaultNavExpanded` seeds
    // it where the provider is mounted.
    const { options, toggleFolderTree } = useOptions()
    const isNavigationPaneOpen = options.folderTree
    // { [spaceName]: { [columnName]: { width?, hidden? } } } -- read once.
    const [columns, setColumns] = useState(() => normaliseColumns(viewOptions?.columns))

    const handleNavigate = (path) => {
        setCurrentPath(path)
        onFolderChange?.(path)
    }

    const triggerAction = useTriggerAction()
    const { containerRef, colSizes, isDragging, handleMouseMove, handleMouseUp, handleMouseDown } = useColumnResize(20, 80)

    const customStyles = {
        '--file-manager-font-family': fontFamily,
        '--file-manager-font-size': fontSize,
        '--file-manager-primary-color': primaryColor,
        // A tile's picture is this across, and the tile is sized off it. The
        // stylesheet reads it so that moving the slider is one style change
        // on one element rather than a re-render of every tile.
        '--file-manager-tile-size': `${options.tileSize}px`,
        height,
        width
    }

    const onSearchFilterChange = (f, regex, casing) => {
        setSrchText(f)
        setSrchRegex(regex)
        setSrchCasing(casing)
    }

    const permissions = useMemo(
        () => ({ ...defaultPermissions, ...userPermissions }),
        [userPermissions]
    )

    let space = initialSpace || 'filedata'
    let spaces = initialSpaces || new Map()

    if (!spaces.has('filedata')) {
        spaces.set('filedata', {
            text: 'Name',
            source: 'name',
            width: 70,
            sumSourceProperty: 'size',
            sumReducer: 1024,
            sumUnits: ['bytes', 'KB', 'MB'],
            icons: new Map(),
            actions: new Map(),
            properties: [
                {
                    name: 'updatedAt',
                    text: 'Modified',
                    source: 'updatedAt',
                    format: 'date',
                    width: 20,
                    sortable: true,
                    visible: true
                },
                {
                    name: 'size',
                    text: 'Size',
                    source: 'size',
                    format: 'size',
                    width: 10,
                    sortable: true,
                    visible: true
                }
            ]
        })
    }

    // Which space's columns are on screen. A folder declaring `children` is
    // listing things of that class, and FileList switches its columns to
    // match, so the widths being dragged are that class's -- not those of the
    // space this component was handed.
    const activeSpace =
        typeof currentFolder?.children === 'string' ? currentFolder.children : space

    // What the header and the rows expect: one flat map of name to width, for
    // the space they are drawing.
    const widths = useMemo(() => {
        const out = {}
        for (const [name, col] of Object.entries(columns[activeSpace] || {})) {
            if (col.width !== undefined) out[name] = col.width
        }
        return out
    }, [columns, activeSpace])

    // Hidden columns are restored onto the spaces, once, because that is where
    // every reader of them looks. The component already writes there when
    // somebody hides a column; this is the same write, for a column somebody
    // hid before reloading.
    const restored = useRef(false)
    useEffect(() => {
        if (restored.current) return
        restored.current = true
        for (const [spaceName, cols] of Object.entries(columns)) {
            const properties = spaces.get(spaceName)?.properties
            if (!properties) continue
            for (const [name, col] of Object.entries(cols)) {
                if (col.hidden === undefined) continue
                const property = properties.find(p => p.name === name)
                if (property) property.visible = !col.hidden
            }
        }
        // Columns are restored from the record the first render read, and the
        // spaces map is the host's own object: neither is state to follow.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // The one place the whole view is assembled, because it is kept in three:
    // the view menu's settings in the options context, the sort in the
    // navigation context, and the columns here. A host is told all of it or
    // none of it.
    //
    // Never on mount: a host that writes what it is told would otherwise write
    // back the record it just supplied, and a host with nothing saved would be
    // handed defaults as though somebody had chosen them.
    const notify = useRef(onViewOptionsChange)
    useEffect(() => { notify.current = onViewOptionsChange })
    const reported = useRef(false)
    useEffect(() => {
        if (!reported.current) {
            reported.current = true
            return
        }
        notify.current?.({ ...options, sort: sortConfig, columns })
    }, [options, sortConfig, columns])

    // A column belongs to a space. Widths used to be one flat map keyed by the
    // column's bare name, shared by every space -- so a width set on the
    // library's Size landed on a transform's Size, which is why navigating
    // threw them all away. Keyed by space, there is nothing to throw away.
    const onHeaderChangeWidth = (name, size) => {
        setColumns(prev => ({
            ...prev,
            [activeSpace]: { ...prev[activeSpace], [name]: { ...prev[activeSpace]?.[name], width: size } },
        }))
    }

    // Which columns are showing is read off the space's own properties, by the
    // header and by every row, so a toggle writes there. It is recorded here
    // as well, because that object belongs to the host and is not something to
    // hand back to it as our state.
    const setHidden = (spaceName, name, hidden) => {
        setColumns(prev => ({
            ...prev,
            [spaceName]: { ...prev[spaceName], [name]: { ...prev[spaceName]?.[name], hidden } },
        }))
    }

    const onHeaderRemove = (spaceName, name) => {
        let col = spaces.get(spaceName).properties.find(p => p.name === name)
        if (col) col.visible = false
        setHidden(spaceName, name, true)
    }

    const onHeaderToggle = (spaceName, name) => {
        let col = spaces.get(spaceName).properties.find(p => p.name === name)
        if (col) col.visible = !col.visible
        setHidden(spaceName, name, col ? !col.visible : undefined)
    }

    const onHeadersReset = (spaceName) => {
        spaces.get(spaceName).properties.forEach(header => header.visible = true)
        setColumns(prev => ({ ...prev, [spaceName]: {} }))
    }

    return (
        <SelectionProvider
            onDownload={onDownload}
            onSelect={onSelect}
            onSelectionChange={onSelectionChange}
        >
            <ClipBoardProvider onPaste={onPaste} onCut={onCut} onCopy={onCopy}>
                <LayoutProvider layout={layout}>

                    <RefHandler 
                        ref={innerRef} 
                        onNavigate={handleNavigate} 
                        lock={() => setIsLocked(true)} 
                        unlock={() => setIsLocked(false)} 
                    />

                    <main
                        className={`file-explorer ${className}`}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ ...customStyles, ...style }}
                    >
                        <Loader loading={isLoading} />

                        <Toolbar
                            onLayoutChange={onLayoutChange}
                            onRefresh={onRefresh}
                            triggerAction={triggerAction}
                            permissions={permissions}
                            spaces={spaces}
                            rightItems={rightItems}
                            searchMode={searchMode}
                            searchText={srchText}
                            searchRegex={srchRegex}
                            searchCasing={srchCasing}
                            categories={categories}
                            showRefresh={showRefresh}
                            showBreadcrumb={showBreadcrumb}
                            minFileActionsLevel={minFileActionsLevel}
                        />

                        <section
                            ref={containerRef}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            className='files-container'
                        >
                            <div
                                className={`navigation-pane ${isNavigationPaneOpen ? 'open' : 'closed'}`}
                                style={{ width: colSizes.col1 + '%' }}
                            >
                                <NavigationPane 
                                    onFileOpen={(file) => file.isDirectory ? handleNavigate(file.path) : onFileOpen(file)} 
                                    icons={icons} 
                                    maxDepth={maxNavigationPaneLevel}
                                />
                                <div
                                    className={`sidebar-resize ${isDragging ? 'sidebar-dragging' : ''}`}
                                    onMouseDown={handleMouseDown}
                                />
                            </div>

                            <div
                                className='folders-preview'
                                style={{ width: (isNavigationPaneOpen ? colSizes.col2 : 100) + '%' }}
                            >
                                <BreadCrumb
                                    collapsibleNav={collapsibleNav}
                                    isNavigationPaneOpen={isNavigationPaneOpen}
                                    onNavigationPaneChange={toggleFolderTree}
                                    tirggerAction={triggerAction}
                                    onSearchFilterChange={onSearchFilterChange}
                                    searchMode={searchMode}
                                    searchText={srchText}
                                    searchRegex={searchRegex}
                                    searchCasing={searchCasing}
                                    categories={categories}
                                    fontFamily={fontFamily}
                                    showBreadcrumb={showBreadcrumb}
                                    onNavigate={handleNavigate}
                                />
                                <Backdrop isLocked={isLocked} message='Waiting...' />
                                <FileList
                                    headersWidth={widths}
                                    columnWidths={widths}
                                    onHeaderChangeWidth={onHeaderChangeWidth}
                                    onHeaderRemove={onHeaderRemove}
                                    onHeaderToggle={onHeaderToggle}
                                    onHeadersReset={onHeadersReset}
                                    actions={actions}
                                    space={space}
                                    spaces={spaces}
                                    icons={icons}
                                    fontFamily={fontFamily}
                                    onCreateFolder={onCreateFolder}
                                    onRename={onRename}
                                    onFileOpen={(file) => file.isDirectory ? handleNavigate(file.path) : onFileOpen(file)}
                                    onRefresh={onRefresh}
                                    enableFilePreview={enableFilePreview}
                                    triggerAction={triggerAction}
                                    permissions={permissions}
                                    formatDate={formatDate}
                                    searchText={srchText}
                                    searchRegex={srchRegex}
                                    searchCasing={srchCasing}
                                    showContextMenu={showContextMenu}
                                    categories={categories}
                                    openMode={openMode}
                                />
                            </div>
                        </section>

                        <Actions
                            fileUploadConfig={fileUploadConfig}
                            onFileUploading={onFileUploading}
                            onFileUploadError={onFileUploadError}
                            onFileUploaded={onFileUploaded}
                            fileDownloadConfig={fileDownloadConfig}
                            onDelete={onDelete}
                            onRefresh={onRefresh}
                            maxFileSize={maxFileSize}
                            filePreviewPath={filePreviewPath}
                            filePreviewComponent={filePreviewComponent}
                            acceptedFileTypes={acceptedFileTypes}
                            triggerAction={triggerAction}
                            permissions={permissions}
                        />
                    </main>
                </LayoutProvider>
            </ClipBoardProvider>
        </SelectionProvider>
    )
}

const FileManager = forwardRef((props, ref) => {
    return (
        <OptionsProvider
            // `viewOptions` is the whole record a host restores, so it wins
            // over the two single-setting props that predate it.
            initial={{
                folderTree: props.defaultNavExpanded,
                tileSize: props.defaultTileSize,
                ...props.viewOptions,
            }}
        >
            <TranslationProvider language={props.language || 'en-US'}>
                <FilesProvider filesData={props.files} onError={props.onError}>
                    {/* Eliminamos el callback del Provider para dispararlo manualmente en el Body */}
                    <FileNavigationProvider
                        initialPath={props.initialPath || ''}
                        initialSort={props.viewOptions?.sort}
                    >
                        <FileManagerBody props={props} innerRef={ref} />
                    </FileNavigationProvider>
                </FilesProvider>
            </TranslationProvider>
        </OptionsProvider>
    )
})

FileManager.displayName = 'FileManager'

FileManager.propTypes = {
    files: PropTypes.arrayOf(
        PropTypes.shape({
            name: PropTypes.string.isRequired,
            isDirectory: PropTypes.bool.isRequired,
            path: PropTypes.string.isRequired,
            updatedAt: dateStringValidator,
            size: PropTypes.number,
            class: PropTypes.string
        })
    ).isRequired,
    fileUploadConfig: PropTypes.shape({
        url: urlValidator,
        headers: PropTypes.objectOf(PropTypes.string),
        method: PropTypes.oneOf(['POST', 'PUT']),
    }),
    isLoading: PropTypes.bool,
    onCreateFolder: PropTypes.func,
    onFileUploading: PropTypes.func,
    onFileUploaded: PropTypes.func,
    onRename: PropTypes.func,
    onDelete: PropTypes.func,
    onCut: PropTypes.func,
    onCopy: PropTypes.func,
    onPaste: PropTypes.func,
    onDownload: PropTypes.func,
    onLayoutChange: PropTypes.func,
    onRefresh: PropTypes.func,
    onFileOpen: PropTypes.func,
    onFolderChange: PropTypes.func,
    onSelect: PropTypes.func,
    onSelectionChange: PropTypes.func,
    onError: PropTypes.func,
    layout: PropTypes.oneOf(['grid', 'list']),
    maxFileSize: PropTypes.number,
    enableFilePreview: PropTypes.bool,
    filePreviewPath: urlValidator,
    acceptedFileTypes: PropTypes.arrayOf(PropTypes.string),
    height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    initialPath: PropTypes.string,
    filePreviewComponent: PropTypes.func,
    primaryColor: PropTypes.string,
    fontFamily: PropTypes.string,
    fontSize: PropTypes.string,
    language: PropTypes.string,
    permissions: PropTypes.shape({
        create: PropTypes.bool,
        upload: PropTypes.bool,
        move: PropTypes.bool,
        copy: PropTypes.bool,
        rename: PropTypes.bool,
        download: PropTypes.bool,
        delete: PropTypes.bool,
    }),
    collapsibleNav: PropTypes.bool,
    defaultNavExpanded: PropTypes.bool,
    // The edge of a tile's picture in the grid, in CSS pixels, before anyone
    // has touched the slider in the status bar. Clamped to TILE_MIN..TILE_MAX.
    defaultTileSize: PropTypes.number,
    // The whole view, as one record -- what a host that remembers it hands
    // back. Read once, at mount: this is where the view starts, not what the
    // view is. Every field is optional and is checked, so a record saved by an
    // older version, or edited by hand, cannot put the component in a state it
    // has no UI for.
    viewOptions: PropTypes.shape({
        statusBar: PropTypes.bool,
        checkBox: PropTypes.bool,
        folderTree: PropTypes.bool,
        breadcrumb: PropTypes.bool,
        tileSize: PropTypes.number,
        sort: PropTypes.shape({
            key: PropTypes.string,
            direction: PropTypes.oneOf(['asc', 'desc']),
            format: PropTypes.string,
        }),
        // Per space, then per column: its width in pixels, and whether it is
        // hidden. Keyed by space because a column belongs to one.
        columns: PropTypes.objectOf(
            PropTypes.objectOf(
                PropTypes.shape({ width: PropTypes.number, hidden: PropTypes.bool })
            )
        ),
    }),
    // Called with that whole record whenever any of it changes, and never on
    // mount. Pair it with `viewOptions` to remember the view; pair the two of
    // them with `layout` and `onLayoutChange`, which work the same way, to
    // remember all of it.
    onViewOptionsChange: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    formatDate: PropTypes.func,
}

export default FileManager