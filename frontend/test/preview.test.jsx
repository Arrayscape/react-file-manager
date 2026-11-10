import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileManager } from '../src/index.js'

// Opening a file opens the preview modal, and the modal has to decide where
// the bytes come from. Both of the props that answer that are optional, so
// `undefined` is a state it must handle rather than concatenate.
//
// It concatenated. A host that serves its own bytes behind a session passes
// neither prop -- it passes filePreviewComponent -- and the modal requested
// `undefined/<path>`, which that host's single-page app answered with its own
// index.html. On screen: a broken image. In the host's log: a request for a
// path that exists nowhere in the application.
//
// The second half of the same bug is what the modal did when a fetch failed:
// the panel written for that case was behind `hasError || (unknownKind && …)`,
// and `true || x` is `true`, which React draws as nothing. So the one case the
// panel existed for was the one case it never appeared in.

const ROOT = { name: 'Library', isDirectory: false, path: '' }
const PICTURE = { name: 'crowd.jpg', isDirectory: false, path: '/crowd.jpg', size: 2048 }

const rowFor = (name) =>
    [...document.querySelectorAll('.file-item-container')].find((el) =>
        el.textContent.trim().startsWith(name),
    )

/** Two clicks rather than a dblclick event: the row decides a double click
 *  itself, by timing consecutive clicks, so a dblclick reaches nothing. */
const open = (name) => {
    const row = rowFor(name)
    fireEvent.click(row)
    fireEvent.click(row)
}

const panel = () => document.querySelector('.preview-error')
const previewImage = () => document.querySelector('.file-previewer img')

describe('previewing a file nobody gave an address for', () => {
    it('asks for nothing', () => {
        render(<FileManager files={[ROOT, PICTURE]} layout="list" />)
        open('crowd.jpg')

        // The assertion is about what is NOT requested, so it reads every src
        // in the document rather than only the one expected element: a
        // fabricated address is just as wrong on a video or an iframe.
        const srcs = [...document.querySelectorAll('[src]')].map((el) => el.getAttribute('src'))
        expect(srcs.filter((s) => s?.includes('undefined'))).toEqual([])
        expect(previewImage()).toBeNull()
    })

    it('says so', () => {
        render(<FileManager files={[ROOT, PICTURE]} layout="list" />)
        open('crowd.jpg')
        expect(panel()).not.toBeNull()
    })

    it('offers no download, because that is the same address it does not have', () => {
        render(<FileManager files={[ROOT, PICTURE]} layout="list" />)
        open('crowd.jpg')
        expect(panel().querySelector('.download-btn')).toBeNull()
    })
})

describe('previewing a file that will not load', () => {
    const props = { files: [ROOT, PICTURE], layout: 'list', filePreviewPath: 'https://example.test' }

    it('fetches from the address it was given', () => {
        render(<FileManager {...props} />)
        open('crowd.jpg')
        expect(previewImage().getAttribute('src')).toBe('https://example.test/crowd.jpg')
    })

    it('shows the panel once the picture fails', () => {
        render(<FileManager {...props} />)
        open('crowd.jpg')
        // jsdom never loads an image, so the failure is delivered rather than
        // waited for. A real browser fires this itself on a 404 or a
        // text/html body, which is exactly the case that showed an empty
        // modal.
        fireEvent.error(previewImage())
        expect(panel()).not.toBeNull()
    })

    it('stops showing the broken picture beside it', () => {
        render(<FileManager {...props} />)
        open('crowd.jpg')
        fireEvent.error(previewImage())
        expect(previewImage()).toBeNull()
    })
})

describe('a host-supplied preview', () => {
    it('replaces the built-in one entirely', () => {
        render(
            <FileManager
                files={[ROOT, PICTURE]}
                layout="list"
                filePreviewComponent={(f) => <div data-testid="custom">{f.name}</div>}
            />,
        )
        open('crowd.jpg')

        // The whole reason the dashboard can show a session-gated picture at
        // all: its own component is rendered in place of the modal's body, so
        // no address is needed.
        expect(screen.getByTestId('custom')).toHaveTextContent('crowd.jpg')
        expect(panel()).toBeNull()
    })
})
