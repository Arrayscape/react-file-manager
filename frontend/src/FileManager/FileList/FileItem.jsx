import React, { useEffect, useRef, useState } from 'react'
import { FaFolder, FaRegFile, FaRegFolderOpen } from 'react-icons/fa6'
import { useFileIcons } from '../../hooks/useFileIcons'
import CreateFolderAction from '../Actions/CreateFolder/CreateFolder.action'
import RenameAction from '../Actions/Rename/Rename.action'
import { useFileNavigation } from '../../contexts/FileNavigationContext'
import { useSelection } from '../../contexts/SelectionContext'
import { useClipBoard } from '../../contexts/ClipboardContext'
import { useLayout } from '../../contexts/LayoutContext'
import { useOptions } from '../../contexts/OptionsContext'
import Checkbox from '../../components/Checkbox/Checkbox'
import { getObjectSize } from '../../utils/getObjectSize'
import { applyFilters } from '../../utils/filters'

const dragIconSize = 50

function convertBytesToSize(bytes, decimals = 2) {
    if (!Number.isFinite(bytes) || bytes === 0) return '0 Bytes'
    
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const units = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const calculatedValue = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
    return calculatedValue + ' ' + units[i]
}        

const FileItem = ({
    columnWidths,
    space,
    spaces,
    icons,
    index,
    file,
    searchText,
    searchRegex,
    searchCasing,
    categories,
    onCreateFolder,
    onRename,
    enableFilePreview,
    onFileOpen,
    filesViewRef,
    selectedFileIndexes,
    triggerAction,
    handleContextMenu,
    setLastSelectedFile,
    draggable,
    formatDate,
    openMode
    }) => {
    const [fileSelected, setFileSelected] = useState(false)
    const [lastClickTime, setLastClickTime] = useState(0)
    const [checkboxClassName, setCheckboxClassName] = useState('hidden')
    const [dropZoneClass, setDropZoneClass] = useState('')
    const [tooltipPosition, setTooltipPosition] = useState(null)

    const { activeLayout } = useLayout()
    const iconSize = activeLayout === 'grid' ? 48 : 20
    const fileIcons = useFileIcons(iconSize)
    const { setCurrentPath, currentPathFiles, onFolderChange, currentFolder } = useFileNavigation()
    const { setSelectedFiles } = useSelection()
    const { clipBoard, handleCutCopy, setClipBoard, handlePasting } = useClipBoard()
    const dragIconRef = useRef(null)
    const dragIcons = useFileIcons(dragIconSize)
    const { options } = useOptions()

    const isFileMoving =
        clipBoard?.isMoving &&
        clipBoard.files.find((f) => f.name === file.name && f.path === file.path)

    const handleFileAccess = () => {
        onFileOpen(file)
        if (file.isDirectory) {
            setCurrentPath(file.path)
            onFolderChange?.(file.path)
            setSelectedFiles([])
        } 
        else {
            enableFilePreview && triggerAction.show('previewFile')
        }
    }

    // `toggleKey` is Ctrl on Windows and Linux, Cmd on macOS. It is passed in
    // already resolved rather than read from the event here, because the two
    // keys mean the same thing to the user and only the caller sees the event.
    const handleFileRangeSelection = (shiftKey, toggleKey) => {
        if (selectedFileIndexes.length > 0 && shiftKey) {
            let reverseSelection = false
            let startRange = selectedFileIndexes[0]
            let endRange = index

            // Reverse Selection
            if (startRange >= endRange) {
                const temp = startRange
                startRange = endRange
                endRange = temp
                reverseSelection = true
            }

            const filesRange = currentPathFiles.slice(startRange, endRange + 1)
            let selected = reverseSelection ? filesRange.reverse() : filesRange
            selected = applyFilters(selected, searchText, searchRegex, searchCasing, categories, currentFolder.categories)
            setSelectedFiles(selected)
        }
        else if (selectedFileIndexes.length > 0 && toggleKey) {
            // Remove file from selected files if it already exists on Ctrl/Cmd + Click, otherwise push it in selectedFiles

            setSelectedFiles((prev) => {
                const filteredFiles = prev.filter((f) => f.path !== file.path)
                if (prev.length === filteredFiles.length) return [...prev, file]
                return applyFilters(filteredFiles, searchText, searchRegex, searchCasing, categories, currentFolder.categories)
            })
        }
        else {
            setSelectedFiles([file])
        }
    }

    const handleFileSelection = (e) => {
        setLastSelectedFile(file) //+++
        e.stopPropagation()
        if (file.isEditing) return

        // On macOS the add-to-selection modifier is Cmd (metaKey); Ctrl+click
        // is the system context-menu gesture there, so reading ctrlKey alone
        // leaves Mac users with no way to extend a selection at all.
        handleFileRangeSelection(e.shiftKey, e.ctrlKey || e.metaKey)

        const currentTime = new Date().getTime()
        if (currentTime - lastClickTime < 300) {
           handleFileAccess()
            return
        }
        setLastClickTime(currentTime)
    }

    const handleOnKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.stopPropagation()
            setSelectedFiles([file])
            handleFileAccess()
        }
    }

    const handleItemContextMenu = (e) => {
        e.stopPropagation()
        e.preventDefault()

        if (file.isEditing) return

        if (!fileSelected) setSelectedFiles([file])

        setLastSelectedFile(file)
        handleContextMenu(e, true, openMode)
    }

    // Selection Checkbox Functions
    const handleMouseOver = () => {
        setCheckboxClassName('visible')
    }

    const handleMouseLeave = () => {
        !fileSelected && setCheckboxClassName('hidden')
    }

    const handleCheckboxChange = (e) => {
        if (e.target.checked) {
            setSelectedFiles((prev) => [...prev, file])
        }
        else {
            setSelectedFiles((prev) => prev.filter((f) => f.name !== file.name && f.path !== file.path))
        }
        setFileSelected(e.target.checked)
    }

    const handleDragStart = (e) => {
        e.dataTransfer.setDragImage(dragIconRef.current, 30, 50)
        e.dataTransfer.effectAllowed = 'copy'
        handleCutCopy(true)
    }

    const handleDragEnd = () => setClipBoard(null)

    const handleDragEnterOver = (e) => {
        e.preventDefault()
        if (fileSelected || !file.isDirectory) {
            e.dataTransfer.dropEffect = 'none'
        } 
        else {
            setTooltipPosition({ x: e.clientX, y: e.clientY + 12 })
            e.dataTransfer.dropEffect = 'copy'
            setDropZoneClass('file-drop-zone')
        }
    }

    const handleDragLeave = (e) => {
        // To stay in dragging state for the child elements of the target drop-zone
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDropZoneClass((prev) => (prev ? '' : prev))
            setTooltipPosition(null)
        }
    }

    const handleDrop = (e) => {
        e.preventDefault()
        if (fileSelected || !file.isDirectory) return

        handlePasting(file)
        setDropZoneClass((prev) => (prev ? '' : prev))
        setTooltipPosition(null)
    }

    useEffect(() => {
        setFileSelected(selectedFileIndexes.includes(index))
        setCheckboxClassName(selectedFileIndexes.includes(index) ? 'visible' : 'hidden')
    }, [selectedFileIndexes])


    function formatAgeCompact({ days, hours, minutes }) {
        let parts = []
        if (days > 0) parts.push(`${days}d`)
        if (hours > 0 || parts.length > 0) parts.push(`${hours}h`)
        if (minutes > 0 && parts.length < 2) parts.push(`${minutes}m`)
        return parts.slice(0, 2).join('')
    }    

    const colNameWidth = () => {
        if (columnWidths['name'])
            return activeLayout==='list'? columnWidths['name']+34 : ''
        else
            return activeLayout==='list'? `calc(${spaces.get(space).width}% - 34px)` : ''
    }

    let showFileName = file.displayName || file.name

    return (
        <div
            className={`file-item-container ${dropZoneClass} ${
                fileSelected || !!file.isEditing ? 'file-selected' : ''
            } ${isFileMoving ? 'file-moving' : ''}`}
            tabIndex={0}
            title={showFileName}
            onClick={handleFileSelection}
            onKeyDown={handleOnKeyDown}
            onContextMenu={handleItemContextMenu}
            onMouseOver={handleMouseOver}
            onMouseLeave={handleMouseLeave}
            draggable={fileSelected && draggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragEnter={handleDragEnterOver}
            onDragOver={handleDragEnterOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className='file-item' style={{ paddingRight:0, paddingLeft: options.checkBox? '33px':'12px', width:colNameWidth()}}>
                { !file.isEditing && options.checkBox && (
                    <Checkbox
                        name={file.name}
                        id={file.name}
                        checked={fileSelected}
                        className={`selection-checkbox ${checkboxClassName}`}
                        onChange={handleCheckboxChange}
                        onClick={(e) => e.stopPropagation()}
                    />)
                }

                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,      // force fixed size icon
                    width: iconSize,    
                    minWidth: iconSize
                }}>
                    { file.isDirectory ?
                        (file.class && icons && icons.get(file.class)?
                                (activeLayout === 'grid'? icons.get(file.class).grid : icons.get(file.class).list) 
                                || 
                                (<FaFolder size={iconSize}/>)
                            :
                                <FaRegFolderOpen size={iconSize} />
                        )
                        : 
                        (
                            file.class && icons && icons.get(file.class)?
                                (React.cloneElement(icons.get(file.class).open || icons.get(file.class).default, {height:40}))
                                :          
                                (fileIcons[file.name?.split('.').pop()?.toLowerCase()] || <FaRegFile size={iconSize} />)
                        )
                    }
                </div>

                { file.isEditing ? (
                        <div className={`rename-file-container ${activeLayout}`}>
                            { triggerAction.actionType === 'createFolder' ? 
                                <CreateFolderAction filesViewRef={filesViewRef} file={file} onCreateFolder={onCreateFolder} triggerAction={triggerAction} />
                            :
                                <RenameAction filesViewRef={filesViewRef} file={file} onRename={onRename} triggerAction={triggerAction} />
                            }
                        </div>
                    )
                    :
                    (
                        activeLayout==='grid' ?
                            <span className='text-truncate file-name'>{showFileName}</span>
                        :
                            <span className='text-truncate file-name' style={{flex: 1, minWidth: 0, fontSize: '0.8em'}}>{showFileName}</span>
                    )
                }
            </div>

            {activeLayout === 'list' && spaces.get(space).properties.filter(p => p.visible).filter(d => d.name!=='name').map((property) => {
                let content = 'n/d'

                if (file.data) {
                    content = file.data[property.source]
                    switch (property.format) {
                        case 'size':
                            content = getObjectSize(spaces.get(space), file.data[property.source])
                            break
                        case 'date':
                            content = formatDate(file.data[property.source])
                            break
                        case 'storage':
                            content = convertBytesToSize(file.data[property.source])
                            break
                        case 'age': {
                            const ms = Date.now() - new Date(file.data[property.source]).getTime()
                            const duracion = {
                                days:    Math.floor(ms / 86400000),
                                hours:   Math.floor((ms % 86400000) / 3600000),
                                minutes: Math.floor((ms % 3600000) / 60000)
                            }
                            content = formatAgeCompact(duracion)
                            break
                        }
                        case 'function':
                            content='n/a'
                            if (property.source && typeof property.source === 'function') content = property.source(file.path)
                            break
                    }
                }
                let w = property.width+'%'
                if (Object.keys(columnWidths).includes(property.name)) {
                    w = columnWidths[property.name]
                }
                return (
                    <div key={property.name} className='text-truncate file-name' style={{display:'flex', width: w, fontSize:'0.8em', alignItems:'center', textAlign:'left'}}>{content}</div>
                )
            })}

            {/* Drag Icon & Tooltip Setup */}
            {tooltipPosition && (
                <div style={{ top: `${tooltipPosition.y}px`, left: `${tooltipPosition.x}px`}} className='drag-move-tooltip'>
                    Move to <span className='drop-zone-file-name'>{showFileName}</span>
                </div>
            )}

            <div ref={dragIconRef} className='drag-icon'>
                {file.isDirectory ? (
                    <FaRegFolderOpen size={dragIconSize} />
                ) : (
                    dragIcons[file.name?.split('.').pop()?.toLowerCase()] ?? (
                        <FaRegFile size={dragIconSize} />
                    )
                )}
            </div>

        </div>
    )
}

export default FileItem
