import MindMap from "simple-mind-map"
import Search from "simple-mind-map/src/plugins/Search"
import Select from "simple-mind-map/src/plugins/Select"
import Drag from "simple-mind-map/src/plugins/Drag"
import Export from "simple-mind-map/src/plugins/Export"
import ExportPDF from "simple-mind-map/src/plugins/ExportPDF"
import KeyboardNavigation from "simple-mind-map/src/plugins/KeyboardNavigation"
import TouchEvent from "simple-mind-map/src/plugins/TouchEvent"
import Scrollbar from "simple-mind-map/src/plugins/Scrollbar"
import Cooperate from "simple-mind-map/src/plugins/Cooperate"
import Comment from "simple-mind-map/src/plugins/Comment"
import ExportXMind from "simple-mind-map/src/plugins/ExportXMind"

export const initPlugins = () => {
  const registerPlugin = MindMap.usePlugin.bind(MindMap)
  registerPlugin(Search)
  registerPlugin(Select)
  registerPlugin(Drag)
  registerPlugin(Export)
  registerPlugin(ExportPDF)
  registerPlugin(KeyboardNavigation)
  registerPlugin(TouchEvent)
  registerPlugin(Scrollbar)
  registerPlugin(Cooperate)
  registerPlugin(Comment)
  registerPlugin(ExportXMind)
}
