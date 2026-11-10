import React from 'react'
import { render, screen } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, SPACES, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// `applyCategories` put every file in a folder declaring a category to
// `onCategoryFilter`, even when the user had chosen no value for it. The
// honest answer to "does this file match the empty selection?" is no, so the
// folder rendered empty.
//
// `isFilterActive` was already part of the category -- it decides whether the
// filter button draws as active -- so it decides this too now.
//
// The second test here matters as much as the first: a fix that simply stopped
// consulting `onCategoryFilter` would pass the first one and break filtering
// altogether.

const base = {
    spaces: SPACES,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
}

const files = assets.map((f) => ({ ...f, categories: ['usage'] }))

const category = ({ active, matches }) => [
    {
        key: 'usage',
        text: 'Usage',
        all: [{ key: 'used', text: 'Used' }],
        selected: active ? ['used'] : [],
        onCategoryValuesChange: () => {},
        onCategoryFilter: (_key, f) => matches(f),
        isFilterActive: () => active,
    },
]

const rows = () => [...document.querySelectorAll('.file-item-container')]

describe('a category filter', () => {
    it('hides nothing while no value is chosen', () => {
        render(
            <FileManager
                {...base}
                files={files}
                categories={category({ active: false, matches: () => false })}
            />,
        )
        expect(rows().length).toBeGreaterThan(0)
        expect(screen.queryByText('This folder is empty.')).toBeNull()
    })

    it('still filters once a value is chosen', () => {
        render(
            <FileManager
                {...base}
                files={files}
                categories={category({
                    active: true,
                    matches: (f) => f.name === 'Archive',
                })}
            />,
        )
        const names = rows().map((r) => r.textContent.trim())
        expect(names.some((n) => n.startsWith('Archive'))).toBe(true)
        expect(names.some((n) => n.startsWith('Event photos'))).toBe(false)
    })

    it('leaves a category without isFilterActive behaving as before', () => {
        const cats = category({ active: false, matches: (f) => f.name === 'Archive' })
        delete cats[0].isFilterActive
        render(<FileManager {...base} files={files} categories={cats} />)
        const names = rows().map((r) => r.textContent.trim())
        expect(names.some((n) => n.startsWith('Archive'))).toBe(true)
        expect(names.some((n) => n.startsWith('Event photos'))).toBe(false)
    })
})
