import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileManager } from '../src/index.js'

// Whether the folder tree is showing was recorded twice: FileManager kept
// `isNavigationPaneOpen`, seeded from `defaultNavExpanded`, which drew the
// pane and the toggle beside the trail; OptionsContext kept `folderTree`,
// hardcoded true, which drew the check in the Options menu. A host asking for
// a collapsed pane therefore got a menu claiming the tree was on, and the
// menu's first click handed the pane the value the check was already
// showing -- so it moved nothing, and the second click did what the first was
// asked to. Off, then on, to get on.
//
// The pane is also rooted now. It listed the top-level folders loose, so it
// disagreed with the trail beside it about whether there was anywhere above
// them: the trail said "Library / ..." while the tree said the folders were
// the top. A record at path '' is where a host names that level, and both read
// it from there.

const files = [
    { name: 'Library', displayName: 'Library', isDirectory: false, path: '', class: 'library' },
    { name: 'Event photos', isDirectory: true, path: '/Event photos' },
    { name: 'Archive', isDirectory: true, path: '/Archive' },
    { name: 'flyer.png', isDirectory: false, path: '/Archive/flyer.png' },
]

const base = { files, layout: 'list' }

const pane = () => document.querySelector('.navigation-pane')
const labels = () =>
    [...document.querySelectorAll('.sb-folder-name')].map((s) => s.textContent.trim())

const menuItem = (name) =>
    [...document.querySelectorAll('li[role="menuitem"]')].find((li) =>
        li.textContent.includes(name),
    )

// The first span of a menu item holds the check, and holds nothing when the
// item is off.
const isChecked = (li) => li.querySelector('span').childElementCount > 0

describe('the folder tree a host asked to start collapsed', () => {
    it('is collapsed, and the Options menu says so', async () => {
        const user = userEvent.setup()
        render(<FileManager {...base} collapsibleNav defaultNavExpanded={false} />)

        expect(pane().className).toContain('closed')

        await user.click(screen.getByTitle('Options'))
        expect(isChecked(menuItem('Folder tree'))).toBe(false)
    })

    it('comes on with one click of the menu, not two', async () => {
        const user = userEvent.setup()
        render(<FileManager {...base} collapsibleNav defaultNavExpanded={false} />)

        await user.click(screen.getByTitle('Options'))
        await user.click(menuItem('Folder tree'))

        expect(pane().className).toContain('open')
    })

    it('goes off with one click when the host asked for it on', async () => {
        const user = userEvent.setup()
        render(<FileManager {...base} collapsibleNav defaultNavExpanded />)

        expect(pane().className).toContain('open')
        await user.click(screen.getByTitle('Options'))
        expect(isChecked(menuItem('Folder tree'))).toBe(true)

        await user.click(menuItem('Folder tree'))
        expect(pane().className).toContain('closed')
    })

    it('and the toggle beside the trail moves the same one state', async () => {
        const user = userEvent.setup()
        render(<FileManager {...base} collapsibleNav defaultNavExpanded />)

        // Closed from the trail, so the only thing that can agree with the
        // menu is the menu reading the same state the toggle just moved.
        await user.click(document.querySelector('.nav-toggler .folder-name-btn'))
        expect(pane().className).toContain('closed')

        await user.click(screen.getByTitle('Options'))
        expect(isChecked(menuItem('Folder tree'))).toBe(false)
    })
})

describe('the folder tree', () => {
    it('is rooted at the top level, named the way the trail names it', () => {
        render(<FileManager {...base} showBreadcrumb />)
        expect(labels()[0]).toBe('Library')
    })

    it('holds the top-level folders inside that root', () => {
        render(<FileManager {...base} showBreadcrumb />)

        const root = document.querySelector('.sb-folders-list > .sb-folders-list-item')
        expect(root.textContent.trim()).toBe('Library')

        const inside = [
            ...document.querySelectorAll('.folder-collapsible .sb-folder-name'),
        ].map((s) => s.textContent.trim())
        expect(inside).toContain('Event photos')
        expect(inside).toContain('Archive')
    })

    it('marks that root with the same glyph the trail marks it with', () => {
        render(<FileManager {...base} showBreadcrumb />)

        const root = document.querySelector('.sb-folders-list > .sb-folders-list-item')
        const treeMark = root.querySelector('.sb-folder-details svg path')
        const trailMark = document.querySelector('.breadcrumb .folder-name svg path')

        expect(treeMark.getAttribute('d')).toBe(trailMark.getAttribute('d'))
    })

    it('calls it home when the host named no top level', () => {
        render(<FileManager {...base} files={files.slice(1)} />)
        expect(labels()[0]).toBe('Home')
    })

    it('still says so when there is nothing in it', () => {
        render(<FileManager {...base} files={[files[0]]} />)
        expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
    })

    it('does not make the top level its own parent', () => {
        // getParentPath('') is '', so a host that marks its record for the
        // top level as a directory used to recurse until the stack died.
        const asFolder = [{ ...files[0], isDirectory: true }, ...files.slice(1)]
        expect(() => render(<FileManager {...base} files={asFolder} />)).not.toThrow()
        expect(labels().filter((l) => l === 'Library')).toHaveLength(1)
    })
})
