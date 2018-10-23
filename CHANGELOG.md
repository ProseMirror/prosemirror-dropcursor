## 1.1.1 (2018-10-23)

### Bug fixes

Fix crash when destroying the plugin, due to a misspelled method name.

## 1.1.0 (2018-10-22)

### Bug fixes

Fixes an issue where drop cursors changed line breaking, causing the content to jump around during dragging.

### New features

Between-blocks drop cursors are now shown as a horizontal line.

## 1.0.1 (2018-06-20)

### Bug fixes

Dragging from a content node directly to the outside of the editor will now properly hide the drop cursor.

Make removal of drop cursor part of the drop transaction when possible.

Use `dropPoint` from prosemirror-transform, rather than a local parallel implementation.

## 1.0.0 (2017-10-13)

First stable release.
