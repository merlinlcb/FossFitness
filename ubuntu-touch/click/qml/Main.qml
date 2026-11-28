// Ubuntu Touch shell for FossFitness: shows the app's web build (www/) in Morph.Web.
// Everything the app stores (localStorage) lives in this app's own WebEngine profile.
import QtQuick 2.12
import Lomiri.Components 1.3
import Morph.Web 0.1
import QtWebEngine 1.10
import Lomiri.Content 1.3

MainView {
    id: root
    objectName: "mainView"
    applicationName: "fossfitness.merlinlcb"
    anchorToKeyboard: true
    backgroundColor: "#000000"

    property var fileRequest: null
    property var transfer: null

    function finishFileRequest(paths) {
        if (!fileRequest) return;
        if (paths && paths.length) fileRequest.dialogAccept(paths);
        else fileRequest.dialogReject();
        fileRequest = null;
    }

    WebContext {
        id: webContext
        storageName: "FossFitness"
        offTheRecord: false
        persistentCookiesPolicy: WebEngineProfile.ForcePersistentCookies
    }

    WebView {
        id: webView
        anchors.fill: parent
        context: webContext
        url: Qt.resolvedUrl("../www/index.html")
        // Ubuntu Touch scales its UI with grid units; web content renders at 1:1 unless we zoom
        // it the same way (8 px per grid unit is the desktop baseline).
        zoomFactor: units.gu(1) / 8
        settings.localStorageEnabled: true
        // The app is loaded from local files but talks to the user's own group server.
        settings.localContentCanAccessRemoteUrls: true
        settings.localContentCanAccessFileUrls: true
        settings.javascriptCanAccessClipboard: true

        // Links that open a new window (e.g. "open in browser") go to the system browser.
        onNewViewRequested: Qt.openUrlExternally(request.requestedUrl)

        // <input type="file"> (expo-image-picker's camera and library on web): show Ubuntu
        // Touch's own picker (Camera, Gallery, Files) instead of QtWebEngine's desktop file dialog.
        onFileDialogRequested: function (request) {
            request.accepted = true;
            root.fileRequest = request;
            var types = (request.acceptedMimeTypes || []).join(",");
            picker.contentType = types === "" || types.indexOf("image") >= 0 ? ContentType.Pictures : ContentType.All;
            picker.multiple = request.mode === FileDialogRequest.FileModeOpenMultiple;
            picker.visible = true;
        }

        onJavaScriptConsoleMessage: {
            if (level >= WebEngineView.WarningMessageLevel)
                console.warn("[web]", message, "(" + sourceID + ":" + lineNumber + ")")
        }
    }

    ContentPeerPicker {
        id: picker
        property bool multiple: false
        anchors.fill: parent
        z: 10
        visible: false
        showTitle: true
        headerText: i18n.tr("Add a photo from")
        contentType: ContentType.Pictures
        handler: ContentHandler.Source
        onPeerSelected: {
            peer.selectionType = picker.multiple ? ContentTransfer.Multiple : ContentTransfer.Single;
            var t = peer.request();
            root.transfer = t;
            t.stateChanged.connect(function () { root.handleTransferState(t); });
            picker.visible = false;
            if (t.state === ContentTransfer.Charged) root.handleTransferState(t);
        }
        onCancelPressed: {
            picker.visible = false;
            root.finishFileRequest([]);
        }
    }

    // Called on every state change of the transfer started in onPeerSelected (the transfer is
    // captured in a closure there, so it can't be lost before it finishes)
    function handleTransferState(t) {
        if (t.state === ContentTransfer.Charged) {
            var paths = [];
            for (var i = 0; i < t.items.length; i++)
                paths.push(String(t.items[i].url).replace(/^file:\/\//, ""));
            finishFileRequest(paths);
            transfer = null;
        } else if (t.state === ContentTransfer.Aborted) {
            finishFileRequest([]);
            transfer = null;
        }
    }
}
