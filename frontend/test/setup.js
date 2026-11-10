import '@testing-library/jest-dom/vitest'

// jsdom has no object URLs. Only the upload and preview paths use them, so a
// file-list test would not normally reach this -- but a component that throws
// on a missing global fails in a way that looks nothing like the thing under
// test, and the stub costs one line.
if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:stub'
    URL.revokeObjectURL = () => {}
}
