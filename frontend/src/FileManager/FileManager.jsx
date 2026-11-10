import { useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import Loader from '../components/Loader/Loader'
import Toolbar from './Toolbar/Toolbar'
import NavigationPane from './NavigationPane/NavigationPane'
import BreadCrumb from './BreadCrumb/BreadCrumb'
import FileList from './FileList/FileList'
import Actions from './Actions/Actions'
import { OptionsProvider } from '../contexts/OptionsContext'
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
        defaultNavExpanded = true,
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

    const { setCurrentPath } = useFileNavigation()
    const [srchText, setSrchText] = useState('')
    const [srchRegex, setSrchRegex] = useState(false)
    const [srchCasing, setSrchCasing] = useState(false)
    const [isNavigationPaneOpen, onNavigationPaneChange] = useState(defaultNavExpanded)
    const [isLocked, setIsLocked] = useState(false)
    const [headersWidth, setHeadersWidth] = useState({})
    const [columnWidths, setColumnWidths] = useState({})

    const handleNavigate = (path) => {
        setHeadersWidth({})
        setColumnWidths({})
        setCurrentPath(path)
        onFolderChange?.(path)
    }

    const triggerAction = useTriggerAction()
    const { containerRef, colSizes, isDragging, handleMouseMove, handleMouseUp, handleMouseDown } = useColumnResize(20, 80)

    const customStyles = {
        '--file-manager-font-family': fontFamily,
        '--file-manager-font-size': fontSize,
        '--file-manager-primary-color': primaryColor,
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

    const onHeaderChangeWidth = (name, size) => {
        setHeadersWidth(prev => ({ ...prev, [name]: size }))
        setColumnWidths(prev => ({ ...prev, [name]: size }))
    }

    const onHeaderRemove = (spaceName, name) => {
        let col = spaces.get(spaceName).properties.find(p => p.name === name)
        if (col) col.visible = false
        setColumnWidths({ ...columnWidths })
    }

    const onHeaderToggle = (spaceName, name) => {
        let col = spaces.get(spaceName).properties.find(p => p.name === name)
        if (col) col.visible = !col.visible
        setColumnWidths({ ...columnWidths })
    }

    const onHeadersReset = (spaceName) => {
        spaces.get(spaceName).properties.forEach(header => header.visible = true)
        setHeadersWidth({})
        setColumnWidths({})
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
                            onNavigationPaneChange={onNavigationPaneChange}
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
                                    onNavigationPaneChange={onNavigationPaneChange}
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
                                    headersWidth={headersWidth}
                                    columnWidths={columnWidths}
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
        <OptionsProvider>
            <TranslationProvider language={props.language || 'en-US'}>
                <FilesProvider filesData={props.files} onError={props.onError}>
                    {/* Eliminamos el callback del Provider para dispararlo manualmente en el Body */}
                    <FileNavigationProvider initialPath={props.initialPath || ''}>
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
    className: PropTypes.string,
    style: PropTypes.object,
    formatDate: PropTypes.func,
}

export default FileManager