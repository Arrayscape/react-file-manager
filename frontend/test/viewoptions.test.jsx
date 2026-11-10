import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileManager } from '../src/index.js'
import { DEFAULT_VIEW_OPTIONS, TILE_MAX, TILE_MIN } from '../src/contexts/OptionsContext'
import { DEFAULT_SORT } from '../src/contexts/FileNavigationContext'

// The view menu's five settings were a one-way street. Two of them could be
// seeded -- `defaultNavExpanded`, `defaultTileSize` -- three could not be
// seeded at all, and none of the five reported a change, so a host could not
// remember what somebody had set. They left the grid at 160px and a hidden
// tree, reloaded, and got 48px and a tree back.
//
// One record in, one callback out. The layout already worked this way
// (`layout` / `onLayoutChange`), so a host that remembers both remembers the
// whole view.

const files = [
    { name: 'Library', displayName: 'Library', isDirectory: false, path: '', class: 'library' },
    { name: 'a.png', isDirectory: false, path: '/a.png' },
]

const base = { files, layout: 'grid' }

const menu = (name) =>
    [...document.querySelectorAll('li[role="menuitem"]')].find((l) =>
        l.textContent.includes(name),
    )
const checked = (li) => li.querySelector('span').childElementCount > 0
const open = (user) => user.click(screen.getByTitle('Options'))

describe('a view a host remembers', () => {
    it('starts where the record says, for every one of the five', async () => {
        const user = userEvent.setup()
        render(
            <FileManager
                {...base}
                showBreadcrumb
                collapsibleNav
                viewOptions={{
                    statusBar: false,
                    checkBox: true,
                    folderTree: false,
                    breadcrumb: false,
                    tileSize: 96,
                }}
            />,
        )

        // Three of these are only visible as state in the menu; two of them
        // are visible on the screen, so check those where they show.
        expect(document.querySelector('.statusbar')).toBeNull()
        expect(document.querySelector('.navigation-pane').className).toContain('closed')
        expect(
            document.querySelector('.file-item > div[style*="flex-shrink"]').style.width,
        ).toBe('96px')

        await open(user)
        expect(checked(menu('Status bar'))).toBe(false)
        expect(checked(menu('Check box'))).toBe(true)
        expect(checked(menu('Folder tree'))).toBe(false)
        expect(checked(menu('Breadcrumb'))).toBe(false)
    })

    it('says nothing until something changes', () => {
        const saved = vi.fn()
        render(<FileManager {...base} viewOptions={{ tileSize: 96 }} onViewOptionsChange={saved} />)
        // A host that writes what it is told must not be told anything yet,
        // or every mount rewrites the record it was just handed -- and a host
        // with nothing saved gets defaults written as if a person chose them.
        expect(saved).not.toHaveBeenCalled()
    })

    it('reports the whole record when one thing changes', async () => {
        const user = userEvent.setup()
        const saved = vi.fn()
        render(<FileManager {...base} onViewOptionsChange={saved} />)

        await open(user)
        await user.click(menu('Check box'))

        expect(saved).toHaveBeenCalledTimes(1)
        // The whole view, not the setting that moved: the host writes one
        // record and does not have to merge anything into it.
        expect(saved.mock.calls[0][0]).toEqual({
            ...DEFAULT_VIEW_OPTIONS,
            checkBox: true,
            sort: DEFAULT_SORT,
            columns: {},
        })
    })

    it('reports the slider too', () => {
        const saved = vi.fn()
        render(<FileManager {...base} onViewOptionsChange={saved} />)

        fireEvent.change(document.querySelector('input.tile-size'), {
            target: { value: '96' },
        })

        expect(saved).toHaveBeenCalledTimes(1)
        expect(saved.mock.calls[0][0].tileSize).toBe(96)
    })

    it('round-trips: what it reported is what it starts as', async () => {
        const user = userEvent.setup()
        const saved = vi.fn()
        const { unmount } = render(<FileManager {...base} onViewOptionsChange={saved} />)

        await open(user)
        await user.click(menu('Status bar'))
        const record = saved.mock.calls.at(-1)[0]
        unmount()

        render(<FileManager {...base} viewOptions={record} />)
        expect(document.querySelector('.statusbar')).toBeNull()
    })

    it('does not re-seed itself from a record the host passes back', async () => {
        const user = userEvent.setup()
        // What a host doing the obvious thing produces: it saves what it was
        // told and re-renders with it. Re-reading the prop here would be
        // harmless in that case and wrong in every other -- so it is read
        // once, and this is the test that says so.
        const { rerender } = render(<FileManager {...base} viewOptions={{ checkBox: false }} />)

        await open(user)
        await user.click(menu('Check box'))
        rerender(<FileManager {...base} viewOptions={{ checkBox: false }} />)

        await open(user)
        expect(checked(menu('Check box'))).toBe(true)
    })

    it('reads a stored record as data, not as state', () => {
        render(
            <FileManager
                {...base}
                viewOptions={{
                    tileSize: 9000,
                    statusBar: 'yes',
                    folderTree: null,
                    somethingElse: 'from an older version',
                }}
            />,
        )
        // Junk and a key from nowhere, so: the number is clamped, the
        // non-booleans fall back, and the unknown key is simply not carried.
        expect(
            document.querySelector('.file-item > div[style*="flex-shrink"]').style.width,
        ).toBe(`${TILE_MAX}px`)
        expect(document.querySelector('.statusbar')).not.toBeNull()
        expect(document.querySelector('.navigation-pane').className).toContain('open')
    })

    it('still honours the two single-setting props, and lets the record win', () => {
        const { unmount } = render(<FileManager {...base} defaultTileSize={TILE_MIN} />)
        expect(
            document.querySelector('.file-item > div[style*="flex-shrink"]').style.width,
        ).toBe(`${TILE_MIN}px`)
        unmount()

        render(<FileManager {...base} defaultTileSize={TILE_MIN} viewOptions={{ tileSize: 96 }} />)
        expect(
            document.querySelector('.file-item > div[style*="flex-shrink"]').style.width,
        ).toBe('96px')
    })
})
