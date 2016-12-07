const {Plugin} = require("prosemirror-state")
const {Decoration, DecorationSet} = require("prosemirror-view")

function dropCursor(options) {
  return new Plugin({
    state: {
      init() { return null },
      applyAction(action, prev, state) {
        if (action.type == "setDropCursor") return pluginStateFor(state, action.pos, options)
        if (action.type == "removeDropCursor") return null
        return prev
      }
    },
    props: {
      handleDOMEvent(view, event) {
        let active = this.getState(view.state)
        switch (event.type) {
        case "dragover":
          let pos = view.posAtCoords({left: event.clientX, top: event.clientY}).pos
          if (!active || active.pos != pos) view.props.onAction({type: "setDropCursor", pos})
          break

        case "dragend":
        case "drop":
          if (active) view.props.onAction({type: "removeDropCursor"})
          break

        case "dragleave":
          if (event.target == view.content) view.props.onAction({type: "removeDropCursor"})
          break
        }
        return false
      },
      decorations(state) {
        let active = this.getState(state)
        return active && active.deco
      }
    }
  })
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
    node.style.cssText = style(options, "left") + "; display: inline-block"
    deco = Decoration.widget(pos, node)
  }
  return {pos, deco: DecorationSet.create(state.doc, [deco])}
}
