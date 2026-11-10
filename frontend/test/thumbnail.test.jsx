import React from 'react'
import { render, screen } from '@testing-library/react'
import { FileManager } from '../src/index.js'

// A per-file thumbnail is our addition: `icons` is keyed by `file.class`, so
// upstream can say "every asset looks like this" but never "this asset looks
// like this".
//
// What this file can prove is that the node reaches the DOM and that rows
// without one keep the icon they always had. What it cannot prove is that the
// picture is the right size or visible at all -- jsdom has no layout, and a
// thumbnail collapsed to zero height would pass every assertion here. That is
// test/browser/thumbnail.py's job.

const PIXEL =
    'data:image/gif;base64,R0lGODlhAgABAPAAAP8A/wAAACH5BAAAAAAALAAAAAACAAEAAAICRAEAOw=='

// Path '' is the root record. It cannot be a directory: the nav pane groups
// directories by parent path, the parent of '' is '', and a directory at ''
// is its own parent.
const ROOT = { name: 'Library', isDirectory: false, path: '' }

const withThumb = {
    name: 'crowd-2026.jpg',
    isDirectory: true,
    path: '/crowd-2026.jpg',
    thumbnail: <img data-testid="thumb" src={PIXEL} alt="" />,
}

const withoutThumb = { name: 'notes.txt', isDirectory: false, path: '/notes.txt' }

// Scoped to the file list on purpose. A directory's name appears in the
// navigation tree as well, so a plain getByText matches twice and throws --
// which says nothing about the component and everything about the query.
const rowFor = (name) =>
    [...document.querySelectorAll('.file-item-container')].find((el) =>
        el.textContent.trim().startsWith(name),
    )

describe('per-file thumbnails', () => {
    it('renders the node the file carries', () => {
        render(<FileManager files={[ROOT, withThumb, withoutThumb]} layout="list" />)
        expect(screen.getByTestId('thumb')).toBeInTheDocument()
    })

    it('puts it in that file\'s own row, not somewhere else', () => {
        render(<FileManager files={[ROOT, withThumb, withoutThumb]} layout="list" />)
        expect(rowFor('crowd-2026.jpg')).toContainElement(screen.getByTestId('thumb'))
    })

    it('leaves a file without one with its icon', () => {
        render(<FileManager files={[ROOT, withThumb, withoutThumb]} layout="list" />)
        const row = rowFor('notes.txt')
        expect(row.querySelector('img')).toBeNull()
        expect(row.querySelector('svg')).not.toBeNull()
    })

    it('does not disturb rows when no file carries one at all', () => {
        render(<FileManager files={[ROOT, withoutThumb]} layout="list" />)
        expect(screen.queryByTestId('thumb')).toBeNull()
        expect(rowFor('notes.txt').querySelector('svg')).not.toBeNull()
    })
})
