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
    console.log('viewportstool registered.');
  }

  deregister() {
    this.viewer.toolController.deactivateTool(this.snapper.getName());
    this.viewer.toolController.deregisterTool(this.snapper);
    this.snapper = null;
    console.log('viewportstool unregistered.');
  }

  activate(name, viewer) {
    if (!this.active) {
      this.viewer.overlays.addScene(ViewportsOverlayName);
      console.log('viewportstool activated.');
      this.active = true;
      this.handleContextMenu();
    }
  }

  deactivate(name) {
    if (this.active) {
      this.viewer.overlays.removeScene(ViewportsOverlayName);
      console.log('DimensionsTool deactivated.');
      this.active = false;
      this.unregisterContexts();
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

  async handleContextMenu(){
    this.unregisterContexts();
    
    viewer.registerContextMenuCallback('gotoview', function (menu, status) {
      // Customize your menu here
      menu.push({
        title: 'Go to View',
        target: function() {
          const tool = viewer.getExtension('ViewportsBrowserToolExtension').tool;
          const result = tool.snapper.getSnapResult();
          const { SnapType } = Autodesk.Viewing.MeasureCommon;
          let selectedPoint = result.intersectPoint.clone();
          tool.viewport = tool.getViewport(selectedPoint, tool.viewer);

          if(!!tool.viewport){
            try {
              let doc = tool.viewer.model.getDocumentNode().getDocument();
              let viewportViewGuid = tool.viewport.viewportRaw.viewGuid;
              let viewable = doc.getRoot().findAllViewables().find(v => v.data.name=='Sheets').children.find(n => n.guid == viewportViewGuid);
              tool.viewer.loadDocumentNode(doc, viewable);
            } catch (error) {
              console.log(error);
              //this means we had an error trying to retrieve points or view
            }
          }
        }
      });
    });

    viewer.registerContextMenuCallback('listelements', function (menu, status) {
      // Customize your menu here
      menu.push({
        title: 'List Elements',
        target: async function() {
          const tool = viewer.getExtension('ViewportsBrowserToolExtension').tool;
          const result = tool.snapper.getSnapResult();
          const { SnapType } = Autodesk.Viewing.MeasureCommon;
          let selectedPoint = result.intersectPoint.clone();
          tool.viewport = tool.getViewport(selectedPoint, tool.viewer);
          if (!!tool.viewport) {
            try{
              let viewportElementsDbIds = await tool.getViewportElements(tool.viewer, tool.viewport);
              tool.viewer.clearSelection();
              console.log(viewportElementsDbIds);
              alert('Check the elements dbids in the console!');
            }
            catch(error){
              console.log(error);
            }
          }
        }
      });
    });

    viewer.registerContextMenuCallback('gotosheet', function (menu, status) {
      // Customize your menu here
      menu.push({
        title: 'Go to Sheet',
        target: function() {
          const tool = viewer.getExtension('ViewportsBrowserToolExtension').tool;
          try {
            tool.viewer.model.getBulkProperties([tool.viewer.getSelection()[0]], ['Sheet Number', 'Sheet Name'], props => {
              tool.sheetNumber = props[0].properties[0].displayValue;
              tool.sheetName = props[0].properties[1].displayValue;
              if(!!tool.sheetNumber && !!tool.sheetName){
                let doc = tool.viewer.model.getDocumentNode().getDocument();
                let viewNode = doc.getRoot().findAllViewables().find(v => v.data.name=='Sheets').children.find(n => n.data.name.includes(tool.sheetNumber) && n.data.name.includes(tool.sheetName));
                tool.viewer.loadDocumentNode(doc, viewNode);
              }
            });
          } catch (error) {
            console.log(error)
            //this means we had an error trying to retrieve points or view
          }
        }
      });
    });
  }

  unregisterContexts(){
    try{
      viewer.unregisterContextMenuCallback('gotoview');
      viewer.unregisterContextMenuCallback('gotosheet');
      viewer.unregisterContextMenuCallback('listelements');
    }
    catch(error){
      console.log(error);
    }
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