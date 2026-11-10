import React from 'react'
import { fireEvent } from '@testing-library/react'
import { render } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, SPACES, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// On macOS the add-to-selection modifier is Cmd (metaKey). Ctrl+click is the
// system context-menu gesture there, so reading `ctrlKey` alone left Mac users
// no way to extend a selection at all. The handler now reads
// `e.ctrlKey || e.metaKey`.
//
// Both modifiers are tested because the fix must not have traded one platform
// for the other.

const props = {
    files: assets,
    spaces: SPACES,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
    // Three files, so there is something to extend a selection across.
    initialPath: '/Event photos',
}

const rows = () => [...document.querySelectorAll('.file-item-container')]

// Scoped to rows. `.file-selected` alone also matches the toolbar, which
// carries it as a state class -- so a single click appeared to select two
// things.
const selected = () =>
    document.querySelectorAll('.file-item-container.file-selected').length

describe('extending a selection', () => {
    it('starts with one row on a plain click', () => {
        render(<FileManager {...props} />)
        fireEvent.click(rows()[0])
        expect(selected()).toBe(1)
    })

    it('adds a row on Cmd+click', () => {
        render(<FileManager {...props} />)
        const r = rows()
        expect(r.length).toBeGreaterThan(1)
        fireEvent.click(r[0])
        fireEvent.click(r[1], { metaKey: true })
        expect(selected()).toBe(2)
    })

    it('adds a row on Ctrl+click', () => {
        render(<FileManager {...props} />)
        const r = rows()
        fireEvent.click(r[0])
        fireEvent.click(r[1], { ctrlKey: true })
        expect(selected()).toBe(2)
    })

    it('replaces the selection on a plain click', () => {
        render(<FileManager {...props} />)
        const r = rows()
        fireEvent.click(r[0])
        fireEvent.click(r[1], { metaKey: true })
        fireEvent.click(r[2])
        expect(selected()).toBe(1)
    })
})
