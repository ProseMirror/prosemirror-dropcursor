import {Plugin} from "prosemirror-state"
import {Decoration, DecorationSet} from "prosemirror-view"

const gecko = typeof navigator != "undefined" && /gecko\/\d/i.test(navigator.userAgent)
const linux = typeof navigator != "undefined" && /linux/i.test(navigator.platform)

export function dropCursor(options) {
  function dispatch(view, data) {
    view.dispatch(view.state.tr.setMeta(plugin, data))
  }

  let timeout = null
  function scheduleRemoval(view) {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (plugin.getState(view.state)) dispatch(view, {type: "remove"})
    }, 1000)
  }

  let plugin = new Plugin({
    state: {
      init() { return null },
      apply(tr, prev, state) {
        // Firefox on Linux gets really confused an breaks dragging when we
        // mess with the nodes around the target node during a drag. So
        // disable this plugin there. See https://bugzilla.mozilla.org/show_bug.cgi?id=1323170
        if (gecko && linux) return null
        let command = tr.getMeta(plugin)
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
            if (view.dragging)
              target = dropPos(view.dragging.slice, view.state.doc.resolve(target))
            if (!active || active.pos != target)
              dispatch(view, {type: "set", pos: target})
          }
          scheduleRemoval(view)
          return false
        },

        dragend(view) {
          if (plugin.getState(view.state)) dispatch(view, {type: "remove"})
          return false
        },

        drop(view) {
          if (plugin.getState(view.state)) dispatch(view, {type: "remove"})
          return false
        },

        dragleave(view, event) {
          if (event.target == view.dom) dispatch(view, {type: "remove"})
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

function dropPos(slice, $pos) {
  if (!slice || !slice.content.size) return $pos.pos
  let content = slice.content
  for (let i = 0; i < slice.openStart; i++) content = content.firstChild.content
  for (let d = $pos.depth; d >= 0; d--) {
    let bias = d == $pos.depth ? 0 : $pos.pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2 ? -1 : 1
    let insertPos = $pos.index(d) + (bias > 0 ? 1 : 0)
    if ($pos.node(d).canReplace(insertPos, insertPos, content))
      return bias == 0 ? $pos.pos : bias < 0 ? $pos.before(d + 1) : $pos.after(d + 1)
  }
  return $pos.pos
}
