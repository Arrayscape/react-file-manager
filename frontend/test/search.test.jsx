import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// SearchInput used to register a `keydown` listener on `window` in the capture
// phase that called stopPropagation() on every event for as long as it was
// mounted. Capture on window runs before anything else, so no key reached any
// element: not the file list, not the host application, and not the name
// editors, whose Enter and Escape handling never ran.
//
// It was there for a reason -- typing in search should not fire the shortcuts
// `useKeyPress` watches for -- and those are on window in the bubble phase, so
// stopping the event on the input as it rises is both sufficient and narrow.
// Both halves are tested here, because restoring the old behaviour would pass
// the second test and fail the first.

const props = {
    files: assets,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
    initialPath: '/Event photos',
}

describe('the search box', () => {
    it('is mounted by default, so these tests are about the live case', () => {
        render(<FileManager {...props} />)
        expect(document.querySelector('.search-input')).not.toBeNull()
    })

    it('does not swallow keys aimed at other elements', () => {
        render(<FileManager {...props} />)

        const row = document.querySelector('.file-item-container')
        let sawOnRow = 0
        row.addEventListener('keydown', () => { sawOnRow += 1 })

        let sawOnWindow = 0
        const onWindow = () => { sawOnWindow += 1 }
        window.addEventListener('keydown', onWindow)

        fireEvent.keyDown(row, { key: 'a' })

        window.removeEventListener('keydown', onWindow)
        expect(sawOnRow).toBe(1)
        expect(sawOnWindow).toBe(1)
    })

    it('keeps its own keystrokes away from the window shortcuts', () => {
        render(<FileManager {...props} />)

        let sawOnWindow = 0
        const onWindow = () => { sawOnWindow += 1 }
        window.addEventListener('keydown', onWindow)

        fireEvent.keyDown(document.querySelector('.search-input'), { key: 'a' })

        window.removeEventListener('keydown', onWindow)
        expect(sawOnWindow).toBe(0)
    })
})
