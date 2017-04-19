# prosemirror-dropcursor

[ [**WEBSITE**](http://prosemirror.net) | [**ISSUES**](https://github.com/prosemirror/prosemirror-dropcursor/issues) | [**FORUM**](https://discuss.prosemirror.net) | [**GITTER**](https://gitter.im/ProseMirror/prosemirror) ]

ProseMirror is a well-behaved rich semantic content editor based on
contentEditable, with support for collaborative editing and custom
document schemas.

This module implements a plugin that shows a drop cursor for
ProseMirror.

The [project page](http://prosemirror.net) has more information, a
number of [demos](http://prosemirror.net/#demos) and the
[documentation](http://prosemirror.net/docs.html).

This code is released under an
[MIT license](https://github.com/prosemirror/prosemirror/tree/master/LICENSE).
There's a [forum](http://discuss.prosemirror.net) for general
discussion and support requests, and the
[Github bug tracker](https://github.com/prosemirror/prosemirror/issues)
is the place to report issues.

## Documentation

**`dropCursor`**`(options: ?Object) → Plugin`

Create a plugin that, when added to a ProseMirror instance, causes a
decoration to show up at the drop position when something is dragged
over the editor.

Options to customize decoration style:
- `color` to set the color of the cursor (defaults to black)
- `width` to set its with in pixels (defaults to 1)

Option to define entirely custom decoration:
- `decorate($pos: ResolvedPos) → ?Decoration` (defaults to builtin decoration)

