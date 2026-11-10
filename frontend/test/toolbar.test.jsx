import React from 'react'
import { render, screen } from '@testing-library/react'
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
