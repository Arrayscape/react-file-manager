import { useEffect, useState } from 'react'
import { BsCopy, BsFolderPlus, BsScissors } from 'react-icons/bs'
import { FiRefreshCw } from 'react-icons/fi'
import { MdOutlineDelete, MdOutlineFileDownload, MdOutlineFileUpload } from 'react-icons/md'
import { BiRename } from 'react-icons/bi'
import { FaRegPaste, FaListCheck } from 'react-icons/fa6'
import { useFileNavigation } from '../../contexts/FileNavigationContext'
import { useSelection } from '../../contexts/SelectionContext'
import { useClipBoard } from '../../contexts/ClipboardContext'
import { validateApiCallback } from '../../utils/validateApiCallback'
import { useTranslation } from '../../contexts/TranslationProvider'
import { ViewOptions } from './ViewOptions'
import './Toolbar.scss'
import { applyFilters } from '../../utils/filters'

const Toolbar = ({ onLayoutChange, onRefresh, triggerAction, permissions, onNavigationPaneChange, spaces, rightItems, searchText, searchRegex, searchCasing, categories,showRefresh, showBreadcrumb, minFileActionsLevel }) => {
    const [ viewOptionsMenuVivible, setViewOptionsMenuVisible ] = useState(false)
    const [ , setTick ] = useState(0)
    const { currentFolder, currentPathFiles, currentOwnLayoutPath } = useFileNavigation()
    const { selectedFiles, setSelectedFiles, handleDownload } = useSelection()
    const { clipBoard, setClipBoard, handleCutCopy, handlePasting } = useClipBoard()
    const t = useTranslation()
    let currentLevel = currentFolder? currentFolder.path.split('/').length-1 : 0

    useEffect( () => {
        setTick(t=> t+1)  // +++ this can be changed for 'recalculate leftItems when selectedFiles changes'
    }, [selectedFiles])
    
    let fileDataLeftItems = []
    if (currentLevel>=minFileActionsLevel) {
        let validLeftItems = []
        validLeftItems.push({
            icon: <BsFolderPlus size={17} strokeWidth={0.3} />,
            text: t('newFolder'),
            permission: permissions.create,
            onClick: () => triggerAction.show('createFolder'),
        })
        validLeftItems.push({
            icon: <MdOutlineFileUpload size={18} />,
            text: t('upload'),
            permission: permissions.upload,
            onClick: () => triggerAction.show('uploadFile'),
        })
        if (clipBoard?.files?.length>0) {
            validLeftItems.push({
                icon: <FaRegPaste size={18} />,
                text: t('paste'),
                permission: !!clipBoard,
                onClick: handleFilePasting,
            })
        }
        fileDataLeftItems = validLeftItems
    }

    let space = currentFolder?.class || 'filedata'

    let leftItems = fileDataLeftItems
    if (space!=='filedata' && spaces && spaces.has(space)) {
        leftItems = spaces.get(space).leftItems || []
        if (leftItems) {
            if (currentPathFiles.length>0 && spaces.get(currentPathFiles[0].class)?.leftItems) {
                if (selectedFiles.length>1) {
                    leftItems = [...leftItems, ...spaces.get(currentPathFiles[0].class).leftItems.filter(i => i.multi)]
                }
                else {
                    if (selectedFiles.length===1) leftItems = [...leftItems, ...spaces.get(currentPathFiles[0].class).leftItems]
                }
            }
            leftItems = leftItems.filter(i => i.text!=='~')
        }
    }

    // Toolbar Items
    const toolbarGenericRightItems = [
        {
            icon: <FaListCheck size={16} />,
            title: t('changeView'),
            onClick: () => setViewOptionsMenuVisible((prev) => !prev),
        },
        ...(showRefresh ?
            [{
                icon: <FiRefreshCw size={16} />,
                title: t('refresh'),
                onClick: () => {
                    validateApiCallback(onRefresh, 'onRefresh');
                    setClipBoard(null);
                }
            }]
            :
            []
        )
    ]

    function handleFilePasting() {
        handlePasting(currentFolder);
    }

    const handleDownloadItems = () => {
        handleDownload()
        setSelectedFiles([])
    }

    const onToolbarFileActionClick = (toolBarAction, target) => {
        if (toolBarAction.onClick)
            toolBarAction.onClick(selectedFiles.map (f => f.path), target)
        else {
            console.log('Click action not configured for', toolBarAction)
        }
    }

    const onToolbarOwnLayoutActionClick = (toolBarAction, target) => {
        toolBarAction.onClick([currentOwnLayoutPath], target)
    }

    const renderLeftItems = (layout) => {
        if (space!=='filedata') {
            let items = []
            if (leftItems) {
                leftItems.map((leftItem, index) => {
                    // A `permission` of false means the host application has
                    // withheld the action. The built-in New Folder, Upload and
                    // Paste items carry one; items supplied by a custom space
                    // leave it undefined, which is not a denial.
                    if (leftItem.permission === false) return

                    if (!leftItem.isVisible || leftItem.isVisible(leftItem.name, currentFolder, selectedFiles)) {
                        let enabled = !leftItem.isEnabled || leftItem.isEnabled(leftItem.name, currentFolder, selectedFiles)
                        if (enabled) {
                            items.push (
                                <button key={index} className='item-action file-action' onClick={(event) => 
                                    layout === 'own'?
                                        onToolbarOwnLayoutActionClick(leftItem, event.currentTarget)
                                    :
                                        onToolbarFileActionClick(leftItem, event.currentTarget)
                                }>
                                    {leftItem.icon}
                                    <span>{leftItem.text}</span>
                                </button>
                            )
                        }
                        else {
                            items.push (
                                <button key={index} className='item-action file-action-disabled'>
                                    {leftItem.icon}
                                    <span>{leftItem.text}</span>
                                </button>
                            )

                        }
                    }
                })
            }
            return <>{items}</>
        }
        else {
            return <>
                {permissions.move && (
                <button className='item-action file-action' onClick={() => handleCutCopy(true)}>
                    <BsScissors size={18} />
                    <span>{t('cut')}</span>
                </button>
                )}
                {permissions.copy && (
                <button className='item-action file-action' onClick={() => handleCutCopy(false)}>
                    <BsCopy strokeWidth={0.1} size={17} />
                    <span>{t('copy')}</span>
                </button>
                )}
                {clipBoard?.files?.length > 0 && (
                <button
                    className='item-action file-action'
                    onClick={handleFilePasting}
                    // disabled={!clipBoard}
                >
                    <FaRegPaste size={18} />
                    <span>{t('paste')}</span>
                </button>
                )}
                {selectedFiles.length === 1 && permissions.rename && (
                <button
                    className='item-action file-action'
                    onClick={() => triggerAction.show('rename')}
                >
                    <BiRename size={19} />
                    <span>{t('rename')}</span>
                </button>
                )}
                {permissions.download && (
                <button className='item-action file-action' onClick={handleDownloadItems}>
                    <MdOutlineFileDownload size={19} />
                    <span>{t('download')}</span>
                </button>
                )}
                {permissions.delete && (
                <button
                    className='item-action file-action'
                    onClick={() => triggerAction.show('delete')}
                >
                    <MdOutlineDelete size={19} />
                    <span>{t('delete')}</span>
                </button>
                )}
            </>
        }
    }

    const onSelectChange = (change) => {
        switch (change) {
            case 'all':
                setSelectedFiles(applyFilters(currentPathFiles, searchText, searchRegex, searchCasing, categories, currentFolder?.categories))
                break
            case 'none':
                setSelectedFiles([])
                break
            case 'invert':
                let result=[]
                for(let f of applyFilters(currentPathFiles, searchText, searchRegex, searchCasing, categories, currentFolder?.categories))
                    if (!selectedFiles.includes(f)) result.push(f)
                setSelectedFiles(result)
                break
        }
    }

    const clickRightItem = (rightItem, target) => {
        if (rightItem.onClick) {
            rightItem.onClick(rightItem.name, target)
        }
        else {
            console.log('No action defined for clicking righItem', rightItem.name)
        }
    }
    
    const renderRightItems = () => {
        let customItems = rightItems || []
        return <>
            {[...customItems, ...toolbarGenericRightItems].map((rightItem, index) => (
                <div key={index} className='toolbar-left-items'>
                    <button className='item-action icon-only file-action' style={{height:'32px'}} title={rightItem.title} onClick={(event) => clickRightItem(rightItem, event.target)} disabled={false}>
                        {rightItem.onDraw?
                            rightItem.onDraw(rightItem.name)
                            :
                            rightItem.icon
                        }
                    </button>
                    {/* {index !== toolbarGenericRightItems.length - 1 && <div className='item-separator'></div>} */}
                </div>
            ))}

            {viewOptionsMenuVivible && (
                <ViewOptions
                    showBreadcrumb={showBreadcrumb}
                    setShowViewOptionsMenu={setViewOptionsMenuVisible}
                    onLayoutChange={onLayoutChange}
                    onNavigationPaneChange={onNavigationPaneChange}
                    onSelectChange={onSelectChange}
                />
            )}
        </>
    }

    return (
        <div className='toolbar file-selected'>
            <div className='file-action-container fm-toolbar'>
                <div>
                    {renderLeftItems(selectedFiles.length > 0? '' : 'own')}
                </div>
                <div>
                    {renderRightItems()}
                </div>
            </div>
        </div>
    )

    // Selected File/Folder Actions
    // this 'if' seems not to be needed
    // if (selectedFiles.length > 0) {
    //     return (<>
    //         <div className='toolbar file-selected'>
    //             <div className='file-action-container fm-toolbar'>
    //                 <div>
    //                     {renderLeftItems()}
    //                 </div>
    //                 <div>
    //                     {renderRightItems()}
    //                 </div>
    //             </div>
    //         </div>
    //     </>
    //     )
    // }

    // return (
    //     <div className='toolbar file-selected'>
    //         <div className='file-action-container fm-toolbar'>
    //             <div>
    //                 {renderLeftItems('own')}
    //             </div>
    //             <div>
    //                 {renderRightItems()}
    //             </div>
    //         </div>
    //     </div>
    // )
}

Toolbar.displayName = 'Toolbar'

export default Toolbar
