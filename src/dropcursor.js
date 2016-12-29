const {Plugin} = require("prosemirror-state")
const {Decoration, DecorationSet} = require("prosemirror-view")

const gecko = typeof navigator != "undefined" && /gecko\/\d/i.test(navigator.userAgent)
const linux = typeof navigator != "undefined" && /linux/i.test(navigator.platform)

function dropCursor(options) {
  let timeout = null
  function scheduleRemoval(view) {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      if (plugin.getState(view.state)) view.props.onAction({type: "removeDropCursor"})
    }, 1000)
  }

  let plugin = new Plugin({
    state: {
      init() { return null },
      applyAction(action, prev, state) {
        // Firefox on Linux gets really confused an breaks dragging when we
        // mess with the nodes around the target node during a drag. So
        // disable this plugin there. See https://bugzilla.mozilla.org/show_bug.cgi?id=1323170
        if (gecko && linux) return null
        if (action.type == "setDropCursor") return pluginStateFor(state, action.pos, options)
        if (action.type == "removeDropCursor") return null
        return prev
      }
    },
    props: {
      handleDOMEvents: {
        dragover(view, event) {
          let active = this.getState(view.state)
          let pos = view.posAtCoords({left: event.clientX, top: event.clientY})
          if (pos && !active || active.pos != pos.pos) view.props.onAction({type: "setDropCursor", pos: pos.pos})
          scheduleRemoval(view)
          return false
        },

        dragend(view) {
          if (this.getState(view.state)) view.props.onAction({type: "removeDropCursor"})
          return false
        },

        drop(view) {
          if (this.getState(view.state)) view.props.onAction({type: "removeDropCursor"})
          return false
        },

        dragleave(view, event) {
          if (event.target == view.content) view.props.onAction({type: "removeDropCursor"})
          return false
        }
      },
      decorations(state) {
        let active = this.getState(state)
        return active && active.deco
      }
    }
  })
  return plugin
}
exports.dropCursor = dropCursor

function style(options, side) {
  let width = (options && options.width) || 1
  let color = (options && options.color) || "black"
  return `border-${side}: ${width}px solid ${color}; margin-${side}: -${width}px`
}

function pluginStateFor(state, pos, options) {
  let $pos = state.doc.resolve(pos), deco
  if (!$pos.parent.isTextblock) {
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
