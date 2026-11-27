// Opens the full-tab offline PDFVault workbench when the toolbar icon is clicked.
const api = typeof browser !== "undefined" ? browser : chrome
api.action.onClicked.addListener(() => {
  api.tabs.create({ url: api.runtime.getURL("src/app.html") })
})
