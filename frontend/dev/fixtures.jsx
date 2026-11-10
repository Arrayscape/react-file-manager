// Data for the fixture app, kept apart from the scenarios that use it.
//
// Everything here exists because some bug or feature needed exactly this shape
// to show itself. Where that is not obvious from the name, there is a comment
// saying which one.
//
// Dependency-light on purpose: react-icons is already a dependency of the
// component, and nothing else is pulled in. The dashboard's spike leaned on
// react-bootstrap, usage badges and a modal, which are its concerns rather
// than the component's.
import React from 'react'
import {
    FaRegImage,
    FaRegFilePdf,
    FaFilm,
    FaRegCircleQuestion,
    FaFolder,
    FaRegFolderOpen,
} from 'react-icons/fa6'

/** A stand-in picture, so the fixtures need no server. */
export const swatch = (hue, label) =>
    `data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80">` +
            `<rect width="120" height="80" fill="hsl(${hue} 55% 72%)"/>` +
            `<text x="60" y="46" font-family="sans-serif" font-size="13" ` +
            `fill="hsl(${hue} 60% 25%)" text-anchor="middle">${label}</text>` +
            `</svg>`,
    )}`

/** The record for the top level.
 *
 *  It cannot be a directory. The navigation pane groups directories by parent
 *  path, the parent of '' is '', so a directory at '' is its own parent and
 *  the tree builder recurses until the stack dies. `isDirectory: false` is
 *  found by the current-folder lookup and skipped by the tree, and is never
 *  listed as a file either, because children are matched as `${path}/${name}`.
 */
export const ROOT = { name: 'Library', isDirectory: false, path: '', class: 'folder' }

const thumbOf = (src) => (
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
)

/** An asset is a folder named after the file, holding original.<ext> and the
 *  transforms derived from it. Folders are just folders; nothing has to be a
 *  file and a directory at once. */
export const assets = [
    ROOT,
    { name: 'Event photos', isDirectory: true, path: '/Event photos', class: 'folder' },
    { name: 'Archive', isDirectory: true, path: '/Archive', class: 'folder' },

    {
        name: 'crowd-2026.jpg',
        isDirectory: true,
        path: '/Event photos/crowd-2026.jpg',
        class: 'asset',
        children: 'transform',
        thumbnail: thumbOf(swatch(25, 'crowd')),
        data: { kind: 'JPEG image', size: 2_310_400, uploader: 'tad', uploadedAt: '2026-10-03T09:04:00Z' },
    },
    {
        name: 'original.jpg',
        isDirectory: false,
        path: '/Event photos/crowd-2026.jpg/original.jpg',
        class: 'transform',
        thumbnail: thumbOf(swatch(25, '3000x2200')),
        // `usedAs` rather than a slot: geometry belongs to the transform, and
        // where it is used is a label on the usage.
        data: { usedAs: 'original', size: 2_310_400, geometry: '3000x2200' },
    },
    {
        name: 'banner.jpg',
        isDirectory: false,
        path: '/Event photos/crowd-2026.jpg/banner.jpg',
        class: 'transform',
        thumbnail: thumbOf(swatch(25, '792 wide')),
        data: { usedAs: 'newsletter banner', size: 84_992, geometry: '792x457' },
    },

    // No thumbnail, and deliberately in the same folder as a row that has
    // one: a fallback that only ever appears in a different folder from the
    // thing it falls back from proves nothing side by side.
    {
        name: 'press-release.pdf',
        isDirectory: false,
        path: '/Event photos/press-release.pdf',
        class: 'pdf',
        data: { kind: 'PDF document', size: 24_880, uploader: 'tad', uploadedAt: '2026-10-04T08:30:00Z' },
    },
    {
        name: 'unlabelled.bin',
        isDirectory: false,
        path: '/Event photos/unlabelled.bin',
        class: 'unknown',
        data: { kind: 'unrecognised', size: 512, uploader: 'tad', uploadedAt: '2026-10-05T08:30:00Z' },
    },

    {
        name: 'terms.pdf',
        isDirectory: false,
        path: '/Archive/terms.pdf',
        class: 'pdf',
        data: { kind: 'PDF document', size: 180_221, uploader: 'tad', uploadedAt: '2026-09-11T12:00:00Z' },
    },
    {
        name: 'mystery.bin',
        isDirectory: false,
        path: '/Archive/mystery.bin',
        class: 'unknown',
        data: { kind: 'unrecognised', size: 991, uploader: 'tad', uploadedAt: '2026-09-12T12:00:00Z' },
    },
]

/** Columns for a folder: our metadata, not name/size/date. */
export const ASSET_SPACE = {
    text: 'Asset',
    source: 'name',
    width: 34,
    configurable: true,
    sumSourceProperty: 'size',
    sumReducer: 1024,
    sumUnits: ['bytes', 'KB', 'MB', 'GB'],
    properties: [
        { name: 'kind', text: 'Type', source: 'kind', format: 'string', width: 16, sortable: true, visible: true },
        { name: 'size', text: 'Size', source: 'size', format: 'storage', width: 12, sortable: true, visible: true },
        { name: 'uploader', text: 'Uploaded by', source: 'uploader', format: 'string', width: 14, sortable: true, visible: true },
        { name: 'uploadedAt', text: 'Uploaded', source: 'uploadedAt', format: 'age', width: 12, sortable: true, visible: true },
    ],
}

/** Columns inside an asset: different questions, so different columns. */
export const TRANSFORM_SPACE = {
    text: 'Transform',
    source: 'name',
    width: 34,
    configurable: true,
    properties: [
        { name: 'usedAs', text: 'Used as', source: 'usedAs', format: 'string', width: 24, sortable: true, visible: true },
        { name: 'geometry', text: 'Pixels', source: 'geometry', format: 'string', width: 16, sortable: false, visible: true },
        { name: 'size', text: 'Size', source: 'size', format: 'storage', width: 14, sortable: true, visible: true },
    ],
}

export const SPACES = new Map([
    ['filedata', ASSET_SPACE],
    ['asset', ASSET_SPACE],
    ['folder', ASSET_SPACE],
    ['transform', TRANSFORM_SPACE],
])

/** Keyed by `class`, which is what the component supports: one node for every
 *  row of a class. A picture of a particular file goes in `thumbnail`. */
export const ICONS = new Map([
    ['folder', { default: <FaFolder />, grid: <FaFolder size={44} />, list: <FaFolder />, open: <FaRegFolderOpen /> }],
    ['asset', { default: <FaRegImage />, grid: <FaRegImage size={44} />, list: <FaRegImage /> }],
    ['transform', { default: <FaRegImage />, grid: <FaRegImage size={44} /> }],
    ['pdf', { default: <FaRegFilePdf />, grid: <FaRegFilePdf size={44} /> }],
    ['video', { default: <FaFilm />, grid: <FaFilm size={44} /> }],
    ['unknown', { default: <FaRegCircleQuestion />, grid: <FaRegCircleQuestion size={44} /> }],
])

export const ALL_PERMISSIONS = {
    create: true, delete: true, download: true,
    copy: true, move: true, rename: true, upload: true,
}
