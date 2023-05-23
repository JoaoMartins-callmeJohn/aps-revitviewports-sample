const ViewportsToolName = 'viewports-tool';
const ViewportsOverlayName = 'viewports-overlay';

class ViewportsTool extends Autodesk.Viewing.ToolInterface {
  constructor(viewer, options) {
    super();
    this.viewer = viewer;
    this.names = [ViewportsToolName];
    this.active = false;
    this.snapper = null;
    // Hack: delete functions defined on the *instance* of a ToolInterface (we want the tool controller to call our class methods instead)
    delete this.register;
    delete this.deregister;
    delete this.activate;
    delete this.deactivate;
    delete this.getPriority;
    delete this.handleMouseMove;
    delete this.handleSingleClick;
    delete this.handleRightClick;
    delete this.handleKeyUp;
  }

  register() {
    this.snapper = new Autodesk.Viewing.Extensions.Snapping.Snapper(this.viewer, { renderSnappedGeometry: false, renderSnappedTopology: false });
    this.viewer.toolController.registerTool(this.snapper);
    this.viewer.toolController.activateTool(this.snapper.getName());
    console.log('DimensionsTool registered.');
  }

  deregister() {
    this.viewer.toolController.deactivateTool(this.snapper.getName());
    this.viewer.toolController.deregisterTool(this.snapper);
    this.snapper = null;
    console.log('DimensionsTool unregistered.');
  }

  activate(name, viewer) {
    if (!this.active) {
      this.viewer.overlays.addScene(ViewportsOverlayName);
      console.log('DimensionsTool activated.');
      this.active = true;
    }
  }

  deactivate(name) {
    if (this.active) {
      this.viewer.overlays.removeScene(ViewportsOverlayName);
      console.log('DimensionsTool deactivated.');
      this.active = false;
      this._reset();
    }
  }

  getPriority() {
    return 13; // Feel free to use any number higher than 0 (which is the priority of all the default viewer tools)
  }

  handleMouseMove(event) {
    // Nothing to do here, yet
    return false;
  }

  handleSingleClick(event){
    // Nothing to do here, yet
    return false;
  }

  async handleRightClick(event){
    viewer.registerContextMenuCallback('your-custom-callback-id', function (menu, status) {
      // Customize your menu here
      menu.push({
        title: 'Go to View',
        target: this.handleViewportLoad()
      });
    });
    
    viewer.unregisterContextMenuCallback('your-custom-callback-id');
  }

  async handleViewportElements(event, button) {
    if (!this.active) {
      return false;
    }

    if (button === 0 && this.snapper.isSnapped()) {
      const result = this.snapper.getSnapResult();
      const { SnapType } = Autodesk.Viewing.MeasureCommon;
      let selectedPoint = result.intersectPoint.clone();
      let viewport = this.getViewport(selectedPoint, this.viewer);
      let viewportElementsDbIds = await this.getViewportElements(this.viewer, viewport);
      this.viewer.clearSelection();
      console.log(viewportElementsDbIds);
    }
    return false;
  }

  async handleViewportLoad(event){
    if (!this.active) {
      return false;
    }

    if (button === 0 && this.snapper.isSnapped()) {
      const result = this.snapper.getSnapResult();
      const { SnapType } = Autodesk.Viewing.MeasureCommon;
      let selectedPoint = result.intersectPoint.clone();
      let data = {};
      let viewport = this.getViewport(selectedPoint, this.viewer);
      try {
        this.viewer.loadDocumentNode(doc, viewables);
      } catch (error) {
        //this means we had an error trying to retrieve points or view
      }
      console.log(data);
    }
  }

  findGuidView(viewable, guid) {
    var guidViews = [];
    // master views are under the "folder" with this UUID
    if (viewable.data.type === 'folder' && viewable.data.name === guid) {
      return viewable.children;
    }
    if (viewable.children === undefined) return;
    viewable.children.forEach((children) => {
      var mv = findGuidView(children, guid);
      if (mv === undefined || mv.length == 0) return;
      guidViews = guidViews.concat(mv);
    })
    return guidViews;
  }

  async getViewportElements(viewer, viewport){
    const tool = viewer.getExtension('Autodesk.BoxSelection').boxSelectionTool;
    let viewportBounds = viewport.getViewportBounds(this.viewer.model.getUnitScale());
    let clientMin = viewer.worldToClient(viewportBounds.min);
    let clientMax = viewer.worldToClient(viewportBounds.max);
    tool.startPoint.set(clientMin.x, clientMin.y);
    tool.endPoint.set(clientMax.x, clientMax.y);
    let selection = await tool.getSelection();
    return selection[0].ids;
  }

  modelToSheet(modelPos, viewport){
    const matrix = viewport.viewportRaw.modelToSheetTransform;
    const sheetPos = new THREE.Vector3(modelPos.x, modelPos.y, modelPos.z).applyMatrix3(matrix);
    return sheetPos;
  }

  getViewport(selectedPoint, viewer) {
    const viewportExt = viewer.getExtension('Autodesk.AEC.ViewportsExtension');
    return viewportExt.findViewportAtPoint(viewer.model, new THREE.Vector2(selectedPoint.x, selectedPoint.y));
  }

  getViewPortName(viewer, viewGuid) {
    let viewName = null;
    viewer.model.getDocumentNode().parent.parent.children.forEach(folder => {
      try {
        folder.data.children.forEach(viewType => {
          viewType.children.forEach(view => {
            if (view.guid == viewGuid) {
              viewName = view.name;
            }
          })
        });
      }
      catch (error) {
        //in this case, the bubble doesn't contain children
      }
    });
    return viewName;

  }

  handleKeyUp(event, keyCode) {

    // Nothimg to do here, yet
    return false;
  }

}

class ViewportsBrowserToolExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this.tool = new ViewportsTool(viewer);
    this.button = null;
  }

  async load() {
    await this.viewer.loadExtension('Autodesk.Snapping');
    this.viewer.toolController.registerTool(this.tool);
    console.log('ViewportsBrowserToolExtension has been loaded.');
    return true;
  }

  async unload() {
    this.viewer.toolController.deregisterTool(this.tool);
    console.log('ViewportsBrowserToolExtension has been unloaded.');
    return true;
  }

  onToolbarCreated(toolbar) {
    const controller = this.viewer.toolController;
    this.button = new Autodesk.Viewing.UI.Button('viewport-tool-button');
    this.button.onClick = (ev) => {
      if (controller.isToolActivated(ViewportsToolName)) {
        controller.deactivateTool(ViewportsToolName);
        this.button.setState(Autodesk.Viewing.UI.Button.State.INACTIVE);
      } else {
        controller.activateTool(ViewportsToolName);
        this.button.setState(Autodesk.Viewing.UI.Button.State.ACTIVE);
      }
    };
    this.button.setToolTip('Viewports Tool');
    this.group = new Autodesk.Viewing.UI.ControlGroup('viewport-tool-group');
    this.group.addControl(this.button);
    toolbar.addControl(this.group);
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension('ViewportsBrowserToolExtension', ViewportsBrowserToolExtension);