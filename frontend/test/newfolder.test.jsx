import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// Enter and Escape in the name editor went unverified for a long time, because
// keyboard input could not be simulated in the harness this was developed
// against: neither CDP's keyDown nor a hand-dispatched KeyboardEvent reached a
// listener. Under a test renderer it is just a synthetic event, so these are
// finally assertable.
//
// No `spaces` prop: the toolbar's New Folder button only exists when the
// folder's class is not a space the host has defined, and with a space
// supplied the built-in items are replaced wholesale.

// One level down, because `minFileActionsLevel` defaults to 1 and
// `currentLevel` at the root is 0 -- so New Folder is deliberately absent
// there, and a test starting at the root would be asserting against a design
// decision rather than a bug.
const props = {
    files: assets,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
    initialPath: '/Event photos',
}

// Re-queried before every dispatch rather than captured once. The editor
// re-renders as its own mount effects set state, and a node React has replaced
// is detached -- dispatching at it does nothing, which makes a test that
// asserts something did NOT happen pass for the wrong reason.
const editor = () => document.querySelector('textarea.rename-file')

const openEditor = () => {
    fireEvent.click(screen.getByText('New Folder'))
    expect(editor()).not.toBeNull()
}

describe('the New Folder name editor', () => {
    it('creates the folder on Enter', () => {
        const onCreateFolder = vi.fn()
        render(<FileManager {...props} onCreateFolder={onCreateFolder} />)
        openEditor()

        fireEvent.change(editor(), { target: { value: 'Campaign assets' } })
        fireEvent.keyDown(editor(), { key: 'Enter' })

        expect(onCreateFolder).toHaveBeenCalledTimes(1)
        expect(onCreateFolder.mock.calls[0][0]).toBe('Campaign assets')
    })

    it('abandons it on Escape', () => {
        const onCreateFolder = vi.fn()
        render(<FileManager {...props} onCreateFolder={onCreateFolder} />)
        openEditor()

        fireEvent.change(editor(), { target: { value: 'Never made' } })
        fireEvent.keyDown(editor(), { key: 'Escape' })

        expect(onCreateFolder).not.toHaveBeenCalled()
    })

    it('takes the editing row away again on Escape', () => {
        render(<FileManager {...props} onCreateFolder={() => {}} />)
        openEditor()
        fireEvent.keyDown(editor(), { key: 'Escape' })
        expect(editor()).toBeNull()
    })

    it('refuses a name carrying a path separator', () => {
        const onCreateFolder = vi.fn()
        render(<FileManager {...props} onCreateFolder={onCreateFolder} />)
        openEditor()

        // The handler rejects the character as it is typed, so the keystroke
        // is what is under test rather than the resulting value.
        fireEvent.keyDown(editor(), { key: '/' })
        expect(screen.getByText(/can't contain any of the following characters/i))
            .toBeInTheDocument()
        expect(onCreateFolder).not.toHaveBeenCalled()
    })
})
