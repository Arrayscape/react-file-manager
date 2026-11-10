import React from 'react'
import { render, screen } from '@testing-library/react'
import { FileManager } from '../src/index.js'

// `name` is the last segment of a file's path and has to stay unique, so a
// host whose paths are ids -- any host where two folders can share a name --
// puts the readable name in `displayName`. The file list shows it, and sorting
// honours it.
//
// The navigation pane and the breadcrumb did not. On screen that meant the
// same folder called two different things at once: a row reading
// "Screenshot 2026-11-02 at 1.27.49 PM.png" beside a tree reading
// "57c3572f-e0d7-4df0-98f3-ce736373e8ff" -- and once you opened it, nothing
// left on screen said which picture you were in, because the row was gone and
// the trail was the id.

const ID = '57c3572f-e0d7-4df0'
const NAME = 'crowd-2026.png'

const files = [
    { name: 'Library', displayName: 'Library', isDirectory: false, path: '', class: 'library' },
    { name: ID, displayName: NAME, isDirectory: true, path: `/${ID}`, class: 'asset' },
    { name: 'original.png', isDirectory: false, path: `/${ID}/original.png`, class: 'transform' },
]

const base = { files, layout: 'list', showBreadcrumb: true }

describe('a folder whose name is an id', () => {
    it('is listed by the name the host gave it', () => {
        render(<FileManager {...base} />)
        const names = [...document.querySelectorAll('.file-item-container')].map((r) =>
            r.textContent.trim(),
        )
        expect(names.join(' | ')).toContain(NAME)
    })

    it('is called the same thing in the navigation pane', () => {
        render(<FileManager {...base} />)
        const labels = [...document.querySelectorAll('.sb-folder-name')].map((s) =>
            s.textContent.trim(),
        )
        expect(labels).toContain(NAME)
        expect(labels).not.toContain(ID)
    })

    it('is called the same thing in the trail, once you are inside it', () => {
        render(<FileManager {...base} initialPath={`/${ID}`} />)
        const trail = [...document.querySelectorAll('.breadcrumb .folder-name')].map((s) =>
            s.textContent.trim(),
        )
        // The one thing on screen whose job is to say where you are.
        expect(trail.join(' / ')).toContain(NAME)
        expect(trail.join(' / ')).not.toContain(ID)
    })

    it('leaves a folder without a displayName alone', () => {
        const plain = [
            files[0],
            { name: 'Archive', isDirectory: true, path: '/Archive', class: 'folder' },
        ]
        render(<FileManager {...base} files={plain} />)
        const labels = [...document.querySelectorAll('.sb-folder-name')].map((s) =>
            s.textContent.trim(),
        )
        expect(labels).toContain('Archive')
    })
})
