import '@testing-library/jest-dom/vitest'

// jsdom has no object URLs. Only the upload and preview paths use them, so a
// file-list test would not normally reach this -- but a component that throws
// on a missing global fails in a way that looks nothing like the thing under
// test, and the stub costs one line.
if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:stub'
    URL.revokeObjectURL = () => {}
}

// jsdom has <dialog> as an element but not its modal behaviour: showModal and
// close are simply absent, so every action modal throws as it mounts. The
// component's own code is what we are testing, and it is correct to call them.
//
// Setting `open` is not cosmetic -- it is what the component reads back, and
// what makes the dialog's children queryable.
if (typeof HTMLDialogElement !== 'undefined') {
    if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
        HTMLDialogElement.prototype.showModal = function () {
            this.open = true
        }
    }
    if (typeof HTMLDialogElement.prototype.close !== 'function') {
        HTMLDialogElement.prototype.close = function () {
            this.open = false
        }
    }
}
