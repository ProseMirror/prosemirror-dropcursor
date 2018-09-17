import {Plugin} from "prosemirror-state"
import {dropPoint} from "prosemirror-transform"
import {Decoration, DecorationSet} from "prosemirror-view"

const gecko = typeof navigator != "undefined" && /gecko\/\d/i.test(navigator.userAgent)
const linux = typeof navigator != "undefined" && /linux/i.test(navigator.platform)

// :: (options: ?Object) → Plugin
// Create a plugin that, when added to a ProseMirror instance,
// causes a decoration to show up at the drop position when something
// is dragged over the editor.
//
//   options::- These options are supported:
//
//     color::? string
//     The color of the cursor. Defaults to `black`.
//
//     width::? number
//     The precise width of the cursor in pixels. Defaults to 1.
export function dropCursor(options) {
  function dispatch(view, data) {
    view.dispatch(view.state.tr.setMeta(plugin, data))
  }

  let timeout = null
  function scheduleRemoval(view, time) {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (plugin.getState(view.state)) dispatch(view, {type: "remove"})
    }, time)
  }

  let plugin = new Plugin({
    state: {
      init() { return null },
      apply(tr, prev, state) {
        // Firefox on Linux gets really confused an breaks dragging when we
        // mess with the nodes around the target node during a drag. So
        // disable this plugin there. See https://bugzilla.mozilla.org/show_bug.cgi?id=1323170
        if (gecko && linux) return null
        let command = tr.getMeta("uiEvent") == "drop" ? {type: "remove"} : tr.getMeta(plugin)
        if (!command) return prev
        if (command.type == "set") return pluginStateFor(state, command.pos, options)
        return null
      }
    },
    props: {
      handleDOMEvents: {
        dragover(view, event) {
          let active = plugin.getState(view.state)
          let pos = view.posAtCoords({left: event.clientX, top: event.clientY})
          if (pos) {
            let target = pos.pos
            if (view.dragging && view.dragging.slice) {
              target = dropPoint(view.state.doc, target, view.dragging.slice)
              if (target == null) target = pos.pos
            }
            if (!active || active.pos != target)
              dispatch(view, {type: "set", pos: target})
          }
          scheduleRemoval(view, 5000)
          return false
        },

        dragend(view) {
          scheduleRemoval(view, 20)
          return false
        },

        drop(view) {
          scheduleRemoval(view, 20)
          return false
        },

        dragleave(view, event) {
          if (event.target == view.dom || !view.dom.contains(event.relatedTarget)) dispatch(view, {type: "remove"})
          return false
        }
      },
      decorations(state) {
        let active = plugin.getState(state)
        return active && active.deco
      }
    }
  })
  return plugin
}

function style(options, side) {
  let width = (options && options.width) || 1
  let color = (options && options.color) || "black"
  return `border-${side}: ${width}px solid ${color}; margin-${side}: -${width}px`
}

function pluginStateFor(state, pos, options) {
  let $pos = state.doc.resolve(pos), deco
  if (!$pos.parent.inlineContent) {
    let before, after
    if (before = $pos.nodeBefore)
      deco = Decoration.node(pos - before.nodeSize, pos, {nodeName: "div", style: style(options, "right")})
    else if (after = $pos.nodeAfter)
      deco = Decoration.node(pos, pos + after.nodeSize, {nodeName: "div", style: style(options, "left")})
  }
  if (!deco) {
    let node = document.createElement("span")
    node.textContent = "\u200b"
    node.style.cssText = style(options, "left") + "; display: inline-block; pointer-events: none"
    deco = Decoration.widget(pos, node)
  }
  return {pos, deco: DecorationSet.create(state.doc, [deco])}
}
