import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileManager } from '../src/index.js'
import { DEFAULT_SORT } from '../src/contexts/FileNavigationContext'

// The sort and the column widths were the other two things a person sets and
// the component forgets. Both are in the same record as the view menu's
// settings, because a host that remembers how the view was left should not
// have to know that the component keeps it in three places.
//
// The widths needed fixing before they could be remembered at all. They were
// one flat map keyed by a column's bare name and shared by every space -- so a
// width dragged on the library's Size column landed on a transform's Size
// column too, and the workaround was to throw every width away on each
// navigation. There was nothing to remember.

const SPACES = () =>
    new Map([
        [
            'library',
            {
                text: 'Name',
                source: 'name',
                width: 60,
                configurable: true,
                properties: [
                    { name: 'kind', text: 'Type', source: 'kind', format: 'string', width: 20, sortable: true, removable: true, visible: true },
                    { name: 'size', text: 'Size', source: 'size', format: 'storage', width: 20, sortable: true, removable: true, visible: true },
                ],
            },
        ],
        [
            'asset',
            {
                text: 'Name',
                source: 'name',
                width: 60,
                configurable: true,
                properties: [
                    { name: 'size', text: 'Size', source: 'size', format: 'storage', width: 40, sortable: true, removable: true, visible: true },
                ],
            },
        ],
    ])

const files = [
    { name: 'Library', displayName: 'Library', isDirectory: false, path: '', class: 'library' },
    {
        name: 'Pictures',
        isDirectory: true,
        path: '/Pictures',
        class: 'asset',
        children: 'asset',
        data: { kind: 'folder', size: 0 },
    },
    { name: 'b.png', isDirectory: false, path: '/b.png', data: { kind: 'image', size: 20 } },
    { name: 'a.png', isDirectory: false, path: '/a.png', data: { kind: 'image', size: 10 } },
]

const base = () => ({ files, layout: 'list', space: 'library', spaces: SPACES() })

const names = () =>
    [...document.querySelectorAll('.file-item-container .file-name')]
        .map((s) => s.textContent.trim())
        .filter((n) => n && n !== 'n/d')

// The name column and every property column carry `id="col-<name>"`; only the
// name column is also `.column-header`.
const headers = () =>
    [...document.querySelectorAll('.files-header [id^="col-"]')].map((h) =>
        h.textContent.replace(/[▲▼]/g, '').trim(),
    )

// A property column's width is on the divider wrapping it.
const columnWidth = (name) =>
    document.querySelector(`.files-header #col-${name}`)?.parentElement.style.width

// The 'x' a removable column offers, which is what hides it.
const removeButton = (name) =>
    [...document.querySelector(`.files-header #col-${name}`).parentElement.children].find(
        (el) => el.tagName === 'SPAN' && el.textContent === 'x',
    )

describe('a remembered sort', () => {
    it('is the order the listing is in on the first render', () => {
        render(<FileManager {...base()} viewOptions={{ sort: { key: 'size', direction: 'desc' } }} />)
        // b is 20 bytes and a is 10, so descending puts b first -- which the
        // default sort, by name, would not.
        const shown = names()
        expect(shown.indexOf('b.png')).toBeLessThan(shown.indexOf('a.png'))
    })

    it('is reported when a header is clicked', async () => {
        const user = userEvent.setup()
        const saved = vi.fn()
        render(<FileManager {...base()} onViewOptionsChange={saved} />)

        await user.click(screen.getByText(/^Size/))

        expect(saved).toHaveBeenCalled()
        expect(saved.mock.calls.at(-1)[0].sort).toEqual({
            key: 'size',
            direction: 'asc',
            format: 'storage',
        })
    })

    it('survives a sort key whose column has gone', () => {
        // A record from a build that had a column this one does not. Sorting
        // by it compares nothing, so the listing is in its natural order --
        // and one click on a header puts it right.
        render(<FileManager {...base()} viewOptions={{ sort: { key: 'uploader' } }} />)
        expect(names().length).toBeGreaterThan(0)
    })

    it('does not fall over sorting rows that carry no data', () => {
        // Reachable by hand before this was remembered -- click Size at a
        // level whose rows are plain folders -- and reachable on the first
        // render once a stored sort arrives.
        const plain = [
            files[0],
            { name: 'One', isDirectory: true, path: '/One' },
            { name: 'Two', isDirectory: true, path: '/Two' },
        ]
        expect(() =>
            render(
                <FileManager {...base()} files={plain} viewOptions={{ sort: { key: 'size' } }} />,
            ),
        ).not.toThrow()
    })
})

describe('remembered columns', () => {
    it('start at the width the record gives them, per space', () => {
        render(
            <FileManager
                {...base()}
                viewOptions={{ columns: { library: { size: { width: 140 } } } }}
            />,
        )
        expect(columnWidth('size')).toBe('140px')
    })

    it('do not leak from one space into another', () => {
        // The library and an asset both have a column called `size`. A width
        // dragged on one used to be the width of the other, which is why this
        // is keyed by space.
        render(
            <FileManager
                {...base()}
                initialPath="/Pictures"
                viewOptions={{ columns: { library: { size: { width: 140 } } } }}
            />,
        )
        expect(columnWidth('size')).toBe('40%')
    })

    it('start hidden if the record says they were hidden', () => {
        render(
            <FileManager
                {...base()}
                viewOptions={{ columns: { library: { kind: { hidden: true } } } }}
            />,
        )
        expect(headers()).not.toContain('Type')
        expect(headers()).toContain('Size')
    })

    it('report being hidden, under the space they belong to', async () => {
        const user = userEvent.setup()
        const saved = vi.fn()
        render(<FileManager {...base()} onViewOptionsChange={saved} />)

        await user.click(removeButton('kind'))

        expect(saved).toHaveBeenCalled()
        expect(saved.mock.calls.at(-1)[0].columns).toEqual({ library: { kind: { hidden: true } } })
        expect(headers()).not.toContain('Type')
    })

    it('reads junk in the record as junk', () => {
        render(
            <FileManager
                {...base()}
                viewOptions={{
                    columns: {
                        library: { size: { width: '140px', hidden: 'yes' }, kind: { width: -5 } },
                        ghost: 'not an object',
                    },
                }}
            />,
        )
        // A string width would reach a style attribute, and a negative one is
        // a broken layout rather than a wrong one. Neither is applied, and
        // nothing is hidden on the strength of the word "yes".
        expect(headers()).toContain('Size')
        expect(headers()).toContain('Type')
        expect(columnWidth('size')).toBe('20%')
    })

    it('are dragged, reported, and survive going into a folder and back', async () => {
        const saved = vi.fn()
        const ref = React.createRef()
        render(<FileManager {...base()} ref={ref} onViewOptionsChange={saved} />)

        // The divider after the Size column is what resizes it.
        const divider = document.querySelector('.files-header #col-size')
            .parentElement.nextElementSibling
        fireEvent.mouseDown(divider, { clientX: 0 })
        fireEvent.mouseMove(document.querySelector('.files-header .files-container'), {
            clientX: 200,
        })
        fireEvent.mouseUp(divider)

        // Not the exact pixel: the drag subtracts the column's padding, which
        // jsdom reports and lays out differently from a browser. What matters
        // is that the drag set a width and reported the one it set.
        const width = parseInt(columnWidth('size'), 10)
        expect(width).toBeGreaterThan(100)
        expect(saved.mock.calls.at(-1)[0].columns).toEqual({ library: { size: { width } } })

        // Every width used to be thrown away on each navigation, because they
        // were keyed by bare name and shared between spaces -- so a width
        // could not outlive opening a folder, let alone a reload.
        await act(async () => ref.current.changeFolder('/Pictures'))
        expect(columnWidth('size')).toBe('40%')

        await act(async () => ref.current.changeFolder(''))
        expect(columnWidth('size')).toBe(`${width}px`)
    })

    it('round-trips the whole view', async () => {
        const user = userEvent.setup()
        const saved = vi.fn()
        const { unmount } = render(<FileManager {...base()} onViewOptionsChange={saved} />)

        await user.click(screen.getByText(/^Size/))
        await user.click(removeButton('kind'))
        const record = saved.mock.calls.at(-1)[0]
        unmount()

        // A fresh spaces Map, as a reload gives: the hidden column has to be
        // restored from the record, not left over in a mutated object.
        render(<FileManager {...base()} viewOptions={record} />)
        expect(headers()).not.toContain('Type')
        const shown = names()
        expect(shown.indexOf('a.png')).toBeLessThan(shown.indexOf('b.png'))
        expect(record.sort).not.toEqual(DEFAULT_SORT)
    })
})
