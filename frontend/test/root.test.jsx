import React from 'react'
import { render, screen } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, SPACES, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// The top level had no folder record: `currentPath` starts as '' and no
// entry's path can match it, so `currentFolder` is null there. Rows were gated
// on it, so the root drew nothing at all while the status bar underneath went
// on counting the files it was not drawing.
//
// Upstream-upstream gates on `currentPathFiles?.length > 0`; this fork had
// changed it to require the record. The fix restores that.

// Without the sentinel at path ''.
//
// This matters more than it looks. With that record present `currentFolder` is
// found at the root and the bug cannot happen at all -- a suite whose fixture
// carries the workaround passes just as happily with the fix reverted, which
// is what a negative control run here actually showed. The fix's claim is that
// a host need not supply a fake non-directory entry to see its own top level.
const noSentinel = assets.filter((f) => f.path !== '')

const props = {
    files: noSentinel,
    spaces: SPACES,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
}

const rows = () => [...document.querySelectorAll('.file-item-container')]

describe('the top level', () => {
    it('lists the folders that live there', () => {
        render(<FileManager {...props} />)
        const names = rows().map((r) => r.textContent.trim())
        expect(names.some((n) => n.startsWith('Event photos'))).toBe(true)
        expect(names.some((n) => n.startsWith('Archive'))).toBe(true)
    })

    it('does not claim to be empty while holding files', () => {
        render(<FileManager {...props} />)
        expect(screen.queryByText('This folder is empty.')).toBeNull()
    })

    it('still says so when it genuinely is empty', () => {
        // The guard must not have been traded for always drawing something.
        render(<FileManager {...props} files={[]} />)
        expect(screen.getByText('This folder is empty.')).toBeInTheDocument()
    })

    it('agrees with its own status bar about how many items there are', () => {
        render(<FileManager {...props} />)
        const bar = document.querySelector('.statusbar')
        // Hardcoded in FileList as `${n} Items`, with non-breaking spaces
        // around the selection half, so match loosely on the leading count.
        expect(bar.textContent).toMatch(new RegExp(`^${rows().length} Items`))
    })
})
