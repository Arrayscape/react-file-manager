import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, ASSET_SPACE, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// A `permission` of false means the host has withheld the action, and the
// toolbar ignored it. Upstream-upstream filters its items on exactly this flag
// (`.filter((item) => item.permission)`); the fork's leftItems refactor lost
// it, so this is a regression rather than a missing feature.
//
// The distinction that matters is false versus undefined. Items a custom space
// supplies carry no `permission` at all, and absent is not a denial -- which
// is why the fix tests `=== false` and not falsiness. A `.filter(i =>
// i.permission)` here would drop every custom item in the fork's model.
//
// Labels are the host's own, not translated ones: `t()` returns empty strings
// under jsdom, because TranslationProvider seeds `t` from i18next before init
// and only rebinds it in an effect. Asserting on English would be asserting on
// that quirk. These labels also exercise the patched path directly -- the
// `permission === false` check is in the custom-space branch.

const leftItems = ({ create }) => [
    { name: 'new', text: 'Make folder', permission: create, onClick: () => {} },
    { name: 'export', text: 'Export list', onClick: () => {} }, // no permission: not a denial
]

const spacesWith = (items) =>
    new Map([
        ['filedata', ASSET_SPACE],
        ['folder', { ...ASSET_SPACE, leftItems: items }],
        ['asset', ASSET_SPACE],
        ['transform', ASSET_SPACE],
    ])

const base = {
    files: assets,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
}

describe('the toolbar', () => {
    it('offers an action the host permits', () => {
        render(<FileManager {...base} spaces={spacesWith(leftItems({ create: true }))} />)
        expect(screen.getByText('Make folder')).toBeInTheDocument()
    })

    it('does not offer one the host withheld', () => {
        render(<FileManager {...base} spaces={spacesWith(leftItems({ create: false }))} />)
        expect(screen.queryByText('Make folder')).toBeNull()
    })

    it('still offers an item that carries no permission at all', () => {
        // The case a truthiness check would break.
        render(<FileManager {...base} spaces={spacesWith(leftItems({ create: false }))} />)
        expect(screen.getByText('Export list')).toBeInTheDocument()
    })

    it('withholds only the one that was withheld', () => {
        render(<FileManager {...base} spaces={spacesWith(leftItems({ create: false }))} />)
        expect(screen.queryByText('Make folder')).toBeNull()
        expect(screen.getByText('Export list')).toBeInTheDocument()
    })
})

// Selecting a row adds the actions belonging to the class of thing in this
// folder, because those are the actions for the thing selected. A host that
// gives the folder and its contents the same items -- the same array, even --
// got each one twice: Upload, Download, Delete, Upload, Download, Delete.
describe('the toolbar when something is selected', () => {
    const shared = [
        { name: 'upload', text: 'Upload', onClick: () => {} },
        { name: 'delete', text: 'Delete', multi: true, onClick: () => {} },
    ]

    // 'folder' is the root record's class and 'asset' is the class of what is
    // inside it, so this is a host that wants one toolbar everywhere.
    const spaces = new Map([
        ['filedata', ASSET_SPACE],
        ['folder', { ...ASSET_SPACE, leftItems: shared }],
        ['asset', { ...ASSET_SPACE, leftItems: shared }],
        ['transform', ASSET_SPACE],
    ])

    const rows = () => [...document.querySelectorAll('.file-item-container')]
    const labelled = (text) =>
        [...document.querySelectorAll('.toolbar button')].filter(
            (b) => b.textContent.trim() === text,
        )

    it('offers each action once before a selection', () => {
        render(<FileManager {...base} spaces={spaces} initialPath="/Event photos" />)
        expect(labelled('Upload')).toHaveLength(1)
    })

    it('still offers each action once after one', () => {
        render(<FileManager {...base} spaces={spaces} initialPath="/Event photos" />)
        fireEvent.click(rows()[0])
        expect(labelled('Upload')).toHaveLength(1)
        expect(labelled('Delete')).toHaveLength(1)
    })

    it('offers a distinct action from the selected class as well', () => {
        // The feature the de-duplication must not break: items the folder does
        // not already have are still added when something is selected.
        const own = [{ name: 'upload', text: 'Upload', onClick: () => {} }]
        const forAssets = [
            own[0], // the same item, which must not be listed twice
            { name: 'download', text: 'Download', onClick: () => {} },
        ]
        render(
            <FileManager
                {...base}
                spaces={
                    new Map([
                        ['filedata', ASSET_SPACE],
                        ['folder', { ...ASSET_SPACE, leftItems: own }],
                        ['asset', { ...ASSET_SPACE, leftItems: forAssets }],
                        ['transform', ASSET_SPACE],
                    ])
                }
                initialPath="/Event photos"
            />,
        )
        fireEvent.click(rows()[0])
        expect(labelled('Upload')).toHaveLength(1)
        expect(labelled('Download')).toHaveLength(1)
    })
})
