import React from 'react'
import { render } from '@testing-library/react'
import { FileManager } from '../src/index.js'

// `filePreviewPath` is optional, and its prop type called an absent prop
// invalid: the validator went straight to `new URL(url)`, which throws on
// undefined like any other bad input. Every host that fetches its own bytes --
// the dashboard, for one -- leaves the prop out and had a warning in the
// console on each mount, which trains people to ignore the console.
//
// This has a test file to itself on purpose. React remembers which prop type
// failures it has already reported and writes each one once per process, so an
// assertion placed after any other render of this component would pass whether
// the validator was fixed or not -- the warning would have been spent before
// the spy was watching. Vitest gives each file its own module registry, which
// is what makes the first render in the file the first render React has seen.

const ROOT = { name: 'Library', isDirectory: false, path: '' }
const PICTURE = { name: 'crowd.jpg', isDirectory: false, path: '/crowd.jpg', size: 2048 }

describe('an optional URL prop nobody passed', () => {
    it('is not reported as an invalid one', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

        render(<FileManager files={[ROOT, PICTURE]} layout="list" />)

        const complaints = spy.mock.calls
            .map((args) => args.join(' '))
            .filter((line) => line.includes('filePreviewPath'))

        spy.mockRestore()
        expect(complaints).toEqual([])
    })
})
