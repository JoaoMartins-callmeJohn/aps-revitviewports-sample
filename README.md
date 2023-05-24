# aps-revitviewports-sample

This sample shows a way to navigate between views based on elements of a Revit sheet such as viewports and annotations.

## THIS IS A WORK IN PROGRESS

### DEMO: https://joaomartins-callmejohn.github.io/aps-revitviewports-sample/

### Introduction

Inside a Revit file sheet, we have many information that is connected with the model and its views and elements.
This data is stored inside the viewports of the sheet viewable, and we can access it through Viewer.

![thumbnail](./assets/thumbnail.gif)

### The approach

We choose to implement this approach with contextmenu based on the click point in the sheet. To put all of that together, we're using a viewer extension.
You can find more information about the access to this data in the blog: https://aps.autodesk.com/blog/consume-aec-data-which-are-model-derivative-api

### Obtaining the viewport

First step is obtaining the viewport from a clicked point in the sheet view.
That can be achieved with the snippet below:

```js
getViewport(selectedPoint, viewer) {
  const viewportExt = viewer.getExtension('Autodesk.AEC.ViewportsExtension');
  return viewportExt.findViewportAtPoint(viewer.model, new THREE.Vector2(selectedPoint.x, selectedPoint.y));
}
```

Where selectedPoint is obtained by the snap result (refer [here](https://aps.autodesk.com/en/docs/viewer/v7/reference/Snapping/Snapper/)) based on an event (mouse click, mouse move...).

Once we have the viewport, we can go further.

#### Listing elements in the Viewport

With the viewport defined, we can use another extension to grab all of the elements inside it.

![Listing the elements](./images/listelements.gif)

We can use `BoxSelection` extension for that, just like in the snippet below:

```js
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
```

In this case, we're basically creating a rectangle that contains the whole viewport programatically.

#### Finding the View referenced by the viewport

Once we have the viewport, we can also have access to its view.

![Finding the view from viewport]()

This is done with the help of the snippet below:

```js
let doc = tool.viewer.model.getDocumentNode().getDocument();
let viewportViewGuid = tool.viewport.viewportRaw.viewGuid;
let viewable = doc
  .getRoot()
  .findAllViewables()
  .find((v) => v.data.name == "Sheets")
  .children.find((n) => n.guid == viewportViewGuid);
// In the line below we load the referenced view ;)
tool.viewer.loadDocumentNode(doc, viewable);
```

#### Finding the Sheet referenced by the annotation in the sheet

For this we don't need the vieport. We are just taking advantage of an element in the sheet that contains the sheet name and id.

![Finding the sheet from the annotation element](./images/gotosheet.gif)

We are doing that based on this element selection, just like in the snippet below:

```js
tool.viewer.model.getBulkProperties(
  [tool.viewer.getSelection()[0]],
  ["Sheet Number", "Sheet Name"],
  (props) => {
    tool.sheetNumber = props[0].properties[0].displayValue;
    tool.sheetName = props[0].properties[1].displayValue;
    if (!!tool.sheetNumber && !!tool.sheetName) {
      let doc = tool.viewer.model.getDocumentNode().getDocument();
      let viewNode = doc
        .getRoot()
        .findAllViewables()
        .find((v) => v.data.name == "Sheets")
        .children.find(
          (n) =>
            n.data.name.includes(tool.sheetNumber) &&
            n.data.name.includes(tool.sheetName)
        );
      tool.viewer.loadDocumentNode(doc, viewNode);
    }
  }
);
```
