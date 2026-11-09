import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaChevronRight } from "react-icons/fa6";
import SubMenu from "./SubMenu";
import "./ContextMenu.scss";

const ContextMenu = ({ contextMenuRef, menuItems, visible, clickPosition }) => {
    const [left, setLeft] = useState(0)
    const [top, setTop] = useState(0)
    const [activeSubMenuIndex, setActiveSubMenuIndex] = useState(null)
    const [subMenuPosition, setSubMenuPosition] = useState("right")

    const subMenuRef = useRef(null)

    // Placed in viewport coordinates, because the menu is rendered into
    // `document.body` and positioned `fixed` — see the portal at the bottom of
    // this file for why.
    //
    // It used to be placed inside the file list and measured against that
    // container, which cannot work: the list scrolls (`overflow-y: auto`), so
    // anything reaching past its edges is cut off, and a menu opened near the
    // bottom or on the last row was cut off exactly when it mattered. The room
    // to fall back on is the room on screen, not the room inside a pane.
    const contextMenuPosition = () => {
        const { clickX, clickY } = clickPosition

        const menu = contextMenuRef.current.getBoundingClientRect()
        const menuWidth = menu.width
        const menuHeight = menu.height
        const margin = 8

        const roomRight = window.innerWidth - clickX > menuWidth
        const roomBelow = window.innerHeight - clickY > menuHeight

        // Open away from the pointer when there is no room in front of it, and
        // never past the edge of the window.
        const clamp = (value, limit) => Math.max(margin, Math.min(value, limit - margin))

        setLeft(`${clamp(roomRight ? clickX : clickX - menuWidth, window.innerWidth - menuWidth)}px`)
        setTop(`${clamp(roomBelow ? clickY : clickY - menuHeight, window.innerHeight - menuHeight)}px`)
        setSubMenuPosition(roomRight ? "right" : "left")
    }

    const handleContextMenu = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleMouseOver = (index) => {
        setActiveSubMenuIndex(index)
    }

    useEffect(() => {
        if (visible && contextMenuRef.current) {
            contextMenuPosition()
        }
        else {
            setTop(0)
            setLeft(0)
            setActiveSubMenuIndex(null)
        }
    }, [visible])

    if (visible) {
        // Into `document.body`, for two reasons.
        //
        // The file list clips whatever leaves it, so a menu living inside it
        // could never open past its edge. And `fixed` inside an ancestor that
        // carries a `transform` — a modal, an offcanvas, anything animating —
        // is fixed to that ancestor rather than to the window, which would put
        // the menu somewhere else entirely.
        //
        // The outside-click handler that closes it reads the DOM rather than
        // the React tree, so it is unaffected.
        return createPortal(<div
            ref={contextMenuRef}
            onContextMenu={handleContextMenu}
            onClick={(e) => e.stopPropagation()}
            className={`fm-context-menu ${top ? "visible" : "hidden"}`}
            style={{
            position: "fixed",
            zIndex: 9999,
            top: top,
            left: left,
            }}
        >
            <div className="file-context-menu-list">
            <ul>
                {menuItems
                .filter((item) => !item.hidden)
                .map((item, index) => {
                    const hasChildren = item.hasOwnProperty("children")
                    const activeSubMenu = activeSubMenuIndex === index && hasChildren
                    return (
                    <div key={item.title}>
                        <li
                            onClick={item.onClick}
                            className={`${item.className ?? ""} ${activeSubMenu ? "active" : ""}`}
                            onMouseOver={() => handleMouseOver(index)}
                            >
                            {item.icon}
                            <span>{item.title}</span>
                            {hasChildren && (
                                <>
                                <FaChevronRight size={14} className="list-expand-icon" />
                                {activeSubMenu && (
                                    <SubMenu
                                    subMenuRef={subMenuRef}
                                    list={item.children}
                                    position={subMenuPosition}
                                    />
                                )}
                                </>
                        )}
                        </li>
                            {item.divider &&
                            index !== menuItems.filter((item) => !item.hidden).length - 1 && (
                                <div className="divider"></div>
                        )}
                    </div>
                    )
                })}
            </ul>
            </div>
        </div>, document.body)
    }
}

export default ContextMenu
