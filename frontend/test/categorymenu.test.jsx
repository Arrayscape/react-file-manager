import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileManager } from '../src/index.js'
import { assets, SPACES, ICONS, ALL_PERMISSIONS } from '../dev/fixtures.jsx'

// The category menu was told `letf={0}` (sic) and `top={30}`, with the anchor
// arithmetic commented out above it. The misspelling meant `left` arrived
// undefined, so nothing in JavaScript placed it horizontally -- and two
// stylesheets define `.category-view`, this component's and HeaderSelector's,
// the second adding `right: 22%`. Where it landed depended on which rule won
// and on whichever containing block it happened to have.
//
// Where it lands is a question for test/browser/. What is assertable here is
// that it reaches document.body rather than the pane, which is half of why the
// other two menus were moved, and that it is placed by explicit coordinates
// rather than left to the cascade.

const categories = [
    {
        key: 'usage',
        text: 'Usage',
        all: [
            { key: 'used', text: 'Used' },
            { key: 'unused', text: 'Unused' },
        ],
        selected: [],
        onCategoryValuesChange: () => {},
        onCategoryFilter: () => true,
        isFilterActive: () => false,
    },
]

const props = {
    files: assets.map((f) => ({ ...f, categories: ['usage'] })),
    spaces: SPACES,
    icons: ICONS,
    permissions: ALL_PERMISSIONS,
    layout: 'list',
    categories,
}

const menu = () =>
    [...document.body.children].find(
        (e) => e.classList?.contains('category-view'),
    )

describe('the category menu', () => {
    it('opens when its button is clicked', () => {
        render(<FileManager {...props} />)
        expect(menu()).toBeUndefined()
        fireEvent.click(screen.getByText('Usage'))
        expect(menu()).not.toBeUndefined()
    })

    it('lists the category values', () => {
        render(<FileManager {...props} />)
        fireEvent.click(screen.getByText('Usage'))
        expect(screen.getByText('Used')).toBeInTheDocument()
        expect(screen.getByText('Unused')).toBeInTheDocument()
    })

    it('is a child of document.body, not of the pane', () => {
        render(<FileManager {...props} />)
        fireEvent.click(screen.getByText('Usage'))
        expect(menu().parentElement).toBe(document.body)
    })

    it('is placed by explicit coordinates rather than by the cascade', () => {
        render(<FileManager {...props} />)
        fireEvent.click(screen.getByText('Usage'))
        const style = menu().style
        expect(style.position).toBe('fixed')
        // jsdom measures everything as zero, so the values cannot be checked
        // here -- only that both were set, where `left` used to be absent
        // entirely because of the misspelling.
        expect(style.left).not.toBe('')
        expect(style.top).not.toBe('')
    })
})
