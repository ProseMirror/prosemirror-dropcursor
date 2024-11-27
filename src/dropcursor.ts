import {Plugin, EditorState} from "prosemirror-state"
import {EditorView} from "prosemirror-view"
import {dropPoint} from "prosemirror-transform"

interface DropCursorOptions {
  /// The color of the cursor. Defaults to `black`. Use `false` to apply no color and rely only on class.
  color?: string | false

  /// The precise width of the cursor in pixels. Defaults to 1.
  width?: number

  /// A CSS class name to add to the cursor element.
  class?: string

  /// A CSS class name to add to the cursor element when not allowed to drop.
  inactiveClass?: string

  /// Should calculate the drop point based on the mouse position. Defaults to `true`.
  shouldCalcDropPoint?: (view: EditorView) => boolean
}

/// Create a plugin that, when added to a ProseMirror instance,
/// causes a decoration to show up at the drop position when something
/// is dragged over the editor.
///
/// Nodes may add a `disableDropCursor` property to their spec to
/// control the showing of a drop cursor inside them. This may be a
/// boolean or a function, which will be called with a view and a
/// position, and should return a boolean.
export function dropCursor(options: DropCursorOptions = {}): Plugin {
  return new Plugin({
    view(editorView) { return new DropCursorView(editorView, options) }
  })
}

// Add disableDropCursor to NodeSpec
declare module "prosemirror-model" {
  interface NodeSpec {
    disableDropCursor?: boolean | ((view: EditorView, pos: { pos: number, inside: number } | null, event: DragEvent) => boolean)
  }
}

class DropCursorView {
  width: number
  color: string | undefined
  class: string | undefined
  inactiveClass: string | undefined
  shouldCalcDropPoint?: (view: EditorView) => boolean
  cursorPos: number | null = null
  element: HTMLElement | null = null
  timeout: number = -1
  handlers: {name: string, handler: (event: Event) => void}[]
  private dragging = false

  constructor(readonly editorView: EditorView, options: DropCursorOptions) {
    this.width = options.width ?? 1
    this.color = options.color === false ? undefined : (options.color || "black")
    this.class = options.class
    this.inactiveClass = options.inactiveClass
    this.shouldCalcDropPoint = options.shouldCalcDropPoint

    this.handlers = ["dragover", "dragend", "drop", "dragleave"].map(name => {
      let handler = (e: Event) => { (this as any)[name](e) }
      editorView.dom.addEventListener(name, handler)
      return {name, handler}
    })
  }

  destroy() {
    clearTimeout(this.timeout)
    this.handlers.forEach(({name, handler}) => this.editorView.dom.removeEventListener(name, handler))
    this.removeElement()
  }

  update(editorView: EditorView, prevState: EditorState) {
    if (this.cursorPos != null && prevState.doc != editorView.state.doc) {
      if (this.cursorPos > editorView.state.doc.content.size) this.setCursor(null)
      else this.updateOverlay()
    }
  }

  private setVisible(visible: boolean) {
    if (this.element) {
      if (visible) {
        if (this.inactiveClass) {
          this.element.classList.remove(this.inactiveClass)
        } else {
          this.element.style.display = ''
        }
      } else {
        if (this.inactiveClass) {
          this.element.classList.add(this.inactiveClass)
        } else {
          this.element.style.display = 'none'
        }
      }
    }
  }

  private removeElement() {
    this.element?.parentNode?.removeChild(this.element)
    this.element = null
  }

  setCursor(pos: number | null) {
    if (pos == this.cursorPos) {
      // cleanup without put dragging state into argument
      if (pos == null && this.element && !this.dragging) {
        this.removeElement()
      }
      return
    }
    this.cursorPos = pos
    if (pos == null) {
      if (this.dragging) {
        this.setVisible(false)
      } else {
        this.removeElement()
      }
    } else {
      this.updateOverlay()
    }
  }

  updateOverlay() {
    let $pos = this.editorView.state.doc.resolve(this.cursorPos!)
    let isBlock = !$pos.parent.inlineContent, rect
    let editorDOM = this.editorView.dom, editorRect = editorDOM.getBoundingClientRect()
    let scaleX = editorRect.width / editorDOM.offsetWidth, scaleY = editorRect.height / editorDOM.offsetHeight
    if (isBlock) {
      let before = $pos.nodeBefore, after = $pos.nodeAfter
      if (before || after) {
        let node = this.editorView.nodeDOM(this.cursorPos! - (before ?  before.nodeSize : 0))
        if (node) {
          let nodeRect = (node as HTMLElement).getBoundingClientRect()
          let top = before ? nodeRect.bottom : nodeRect.top
          if (before && after)
            top = (top + (this.editorView.nodeDOM(this.cursorPos!) as HTMLElement).getBoundingClientRect().top) / 2
          let halfWidth = (this.width / 2) * scaleY
          rect = {left: nodeRect.left, right: nodeRect.right, top: top - halfWidth, bottom: top + halfWidth}
        }
      }
    }
    if (!rect) {
      let coords = this.editorView.coordsAtPos(this.cursorPos!)
      let halfWidth = (this.width / 2) * scaleX
      rect = {left: coords.left - halfWidth, right: coords.left + halfWidth, top: coords.top, bottom: coords.bottom}
    }

    let parent = this.editorView.dom.offsetParent as HTMLElement
    if (!this.element) {
      this.element = parent.appendChild(document.createElement("div"))
      if (this.class) this.element.className = this.class
      this.element.style.cssText = "position: absolute; z-index: 50; pointer-events: none;"
      if (this.color) {
        this.element.style.backgroundColor = this.color
      }
    }
    this.element.classList.toggle("prosemirror-dropcursor-block", isBlock)
    this.element.classList.toggle("prosemirror-dropcursor-inline", !isBlock)
    let parentLeft, parentTop
    if (!parent || parent == document.body && getComputedStyle(parent).position == "static") {
      parentLeft = -pageXOffset
      parentTop = -pageYOffset
    } else {
      let rect = parent.getBoundingClientRect()
      let parentScaleX = rect.width / parent.offsetWidth, parentScaleY = rect.height / parent.offsetHeight
      parentLeft = rect.left - parent.scrollLeft * parentScaleX
      parentTop = rect.top - parent.scrollTop * parentScaleY
    }
    this.element.style.left = (rect.left - parentLeft) / scaleX + "px"
    this.element.style.top = (rect.top - parentTop) / scaleY + "px"
    this.element.style.width = (rect.right - rect.left) / scaleX + "px"
    this.element.style.height = (rect.bottom - rect.top) / scaleY + "px"
    this.setVisible(true)
  }

  scheduleRemoval(timeout: number) {
    clearTimeout(this.timeout)
    this.timeout = setTimeout(() => this.setCursor(null), timeout)
  }

  dragover(event: DragEvent) {
    if (!event.dataTransfer) return
    if (!this.editorView.editable) return
    this.dragging = true
    let pos = this.editorView.posAtCoords({left: event.clientX, top: event.clientY})

    let node = pos && pos.inside >= 0 && this.editorView.state.doc.nodeAt(pos.inside)
    let disableDropCursor = node && node.type.spec.disableDropCursor
    let disabled = typeof disableDropCursor == "function" ? disableDropCursor(this.editorView, pos, event) : disableDropCursor
    if (pos && !disabled) {
      event.dataTransfer.dropEffect = "move"
      let target = pos.pos
      if (this.editorView.dragging && this.editorView.dragging.slice) {
        const shouldCalcDropPoint =
          !this.shouldCalcDropPoint || this.shouldCalcDropPoint(this.editorView)
        if (shouldCalcDropPoint) {
          const point = dropPoint(
            this.editorView.state.doc,
            target,
            this.editorView.dragging.slice
          )
          if (point != null) target = point
        }
      }
      this.setCursor(target)
      this.scheduleRemoval(5000)
    } else {
      event.dataTransfer.dropEffect = "none"
    }
  }

  dragend() {
    this.dragging = false
    this.scheduleRemoval(20)
  }

  drop() {
    this.dragging = false
    this.scheduleRemoval(20)
  }

  dragleave(event: DragEvent) {
    if (event.target == this.editorView.dom) {
      this.setCursor(null)
    } else if (!this.editorView.dom.contains((event as any).relatedTarget)) {
      this.dragging = false
      this.setCursor(null)
    }
  }
}
