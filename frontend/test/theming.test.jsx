import React from 'react'
import { render } from '@testing-library/react'
import { FileManager } from '../src/index.js'

// A component embedded in somebody else's page has to be able to take that
// page's type, or it always looks borrowed. The font family and the primary
// colour were already props; the size was a Sass constant compiled into the
// stylesheet, so a host could not reach it at all without writing CSS against
// our class names -- which is a promise we would then have to keep.
//
// It is a custom property with the old value as its default, so a host that
// passes nothing is unaffected.

const files = [{ name: 'Library', isDirectory: false, path: '' }]

const root = () => document.querySelector('.file-explorer')

describe('taking the host page\'s type', () => {
    it('passes the font family through', () => {
        render(<FileManager files={files} fontFamily="inherit" />)
        expect(root().style.getPropertyValue('--file-manager-font-family')).toBe('inherit')
    })

    it('passes the font size through', () => {
        render(<FileManager files={files} fontSize="0.9rem" />)
        expect(root().style.getPropertyValue('--file-manager-font-size')).toBe('0.9rem')
    })

    it('passes the primary colour through', () => {
        render(<FileManager files={files} primaryColor="var(--primary-color)" />)
        expect(root().style.getPropertyValue('--file-manager-primary-color')).toBe(
            'var(--primary-color)',
        )
    })

    it('sets no size of its own when the host passes none', () => {
        // So the stylesheet's default applies, rather than an empty value
        // winning the cascade.
        render(<FileManager files={files} />)
        expect(root().style.getPropertyValue('--file-manager-font-size')).toBe('')
    })
})
