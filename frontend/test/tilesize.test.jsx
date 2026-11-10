import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileManager } from '../src/index.js'
import { TILE_MIN, TILE_MAX, TILE_DEFAULT } from '../src/contexts/OptionsContext'

// The grid drew every tile at one size, 48px, written into the stylesheet and
// into FileItem as a literal. A library of pictures is browsed by looking at
// them, so the size of the picture is the whole view -- which is why the
// Finder puts a slider in the corner of its status bar and nothing else in it.
//
// One number drives it: the edge of the picture. The tile is that plus a
// constant, in the stylesheet, so a drag is one style change on one element
// rather than a re-render of every tile.

const files = [
    { name: 'Library', displayName: 'Library', isDirectory: false, path: '', class: 'library' },
    { name: 'a.png', isDirectory: false, path: '/a.png' },
    { name: 'b.png', isDirectory: false, path: '/b.png' },
]

const base = { files, layout: 'grid' }

const slider = () => document.querySelector('.statusbar input.tile-size')
const explorer = () => document.querySelector('.file-explorer')
const declared = () => explorer().style.getPropertyValue('--file-manager-tile-size')
// The box FileItem gives the icon, which is the picture's own size.
const iconBox = () =>
    document.querySelector('.file-item > div[style*="flex-shrink"]')?.style.width

describe('the size of a tile', () => {
    it('starts at the default, and says so in both places', () => {
        render(<FileManager {...base} />)
        expect(slider().value).toBe(String(TILE_DEFAULT))
        expect(declared()).toBe(`${TILE_DEFAULT}px`)
        expect(iconBox()).toBe(`${TILE_DEFAULT}px`)
    })

    it('starts where the host asked', () => {
        render(<FileManager {...base} defaultTileSize={96} />)
        expect(slider().value).toBe('96')
        expect(declared()).toBe('96px')
        expect(iconBox()).toBe('96px')
    })

    it('follows the slider', () => {
        render(<FileManager {...base} />)

        // What a drag reports, without the pointer geometry jsdom has not
        // got. That a real drag reports it is measured in test/browser.
        fireEvent.change(slider(), { target: { value: '96' } })

        expect(slider().value).toBe('96')
        expect(declared()).toBe('96px')
        expect(iconBox()).toBe('96px')
    })

    it('stops at both ends', () => {
        render(<FileManager {...base} />)
        expect(Number(slider().min)).toBe(TILE_MIN)
        expect(Number(slider().max)).toBe(TILE_MAX)
    })

    it('refuses a host size outside them', () => {
        render(<FileManager {...base} defaultTileSize={4000} />)
        expect(declared()).toBe(`${TILE_MAX}px`)
    })

    it('is offered only where there is a tile to resize', () => {
        render(<FileManager {...base} layout="list" />)
        expect(slider()).toBeNull()
        // The row's icon is part of a line of text and is not the slider's to
        // move, so the list keeps its own fixed size.
        expect(iconBox()).toBe('20px')
    })

    it('goes with the status bar it lives in', async () => {
        const user = userEvent.setup()
        render(<FileManager {...base} />)
        expect(slider()).not.toBeNull()

        await user.click(screen.getByTitle('Options'))
        await user.click(
            [...document.querySelectorAll('li[role="menuitem"]')].find((l) =>
                l.textContent.includes('Status bar'),
            ),
        )
        expect(slider()).toBeNull()
    })

    it('leaves the count room, and stays out of its way', () => {
        render(<FileManager {...base} />)
        const bar = document.querySelector('.statusbar')
        // The count is a span of its own rather than a bare text node, so the
        // bar can give it the leftover width and put the slider beside it.
        expect(bar.querySelector('.statusbar-text').textContent).toContain('Items')
        expect(bar.lastElementChild).toBe(slider())
    })
})
