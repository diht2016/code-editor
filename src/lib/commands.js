import saveFile from "./saveFile";
import select from './handlers/selectword';
import runPreview from "./runPreview";

import settingsMain from '../pages/settings/mainSettings';
import dialogs from '../components/dialogs';
import openFile from "./openFile";
import openFolder from "./openFolder";
import helpers from "../lib/utils/helpers";
import constants from "./constants";
import GithubLogin from "../pages/login/login";
import gitHub from "../pages/github/gitHub";
import help from '../pages/help';
import recents from '../lib/recents';
import fsOperation from '../lib/fileSystem/fsOperation';
import Modes from '../pages/modes/modes';
import clipboardAction from '../lib/clipboard';
import quickTools from './handlers/quickTools';
import FTPAccounts from "../pages/ftp-accounts/ftp-accounts";
import FileBrowser from "../pages/fileBrowser/fileBrowser";
import Url from "./utils/Url";
import path from "./utils/path";
import showFileInfo from "./showFileInfo";

const commands = {
  "console": function () {
    runPreview(true, 'in app');
  },
  "copy": function () {
    clipboardAction('copy');
  },
  "color": function () {
    clipboardAction("color");
  },
  "cut": function () {
    clipboardAction('cut');
  },
  "disable-fullscreen": function () {
    app.classList.remove("fullscreen-mode");
    this["resize-editor"]();
  },
  "enable-fullscreen": function () {
    // system.enableFullScreen();
    app.classList.add("fullscreen-mode");
    this["resize-editor"]();
  },
  "encoding": function () {
    dialogs.select(strings.encoding, constants.encodings, {
        default: editorManager.activeFile.encoding
      })
      .then(encoding => {
        const file = editorManager.activeFile;
        file.encoding = encoding;
        const text = file.session.getValue();
        const decodedText = new TextEncoder().encode(text);
        const newText = new TextDecoder(encoding).decode(decodedText);
        file.session.setValue(newText);
        file.isUnsaved = false;
        editorManager.onupdate();
      });
  },
  "find": function () {
    quickTools.actions('search');
  },
  "format": function () {
    const file = editorManager.activeFile;
    const editor = editorManager.editor;

    let pos = editor.getCursorPosition();
    const tmp = editorManager.onupdate;
    editorManager.onupdate = () => {};
    beautify(file.session);
    editorManager.onupdate = tmp;
    editor.selection.moveCursorToPosition(pos);
  },
  "ftp": function () {
    FTPAccounts();
  },
  "file-info": showFileInfo,
  "github": function () {
    if ((!localStorage.username || !localStorage.password) && !localStorage.token)
      return GithubLogin();
    gitHub();
  },
  "goto": function () {
    dialogs.prompt(strings['enter line number'], '', 'number', {
        placeholder: 'line.column'
      }).then(lineNumber => {
        const editor = editorManager.editor;
        editor.focus();
        const [line, col] = lineNumber.split(".");
        editor.gotoLine(line, col, true);
      })
      .catch(err => {
        console.log(err);
      });
  },
  "new-file": function () {
    dialogs.prompt(strings['enter file name'], constants.DEFAULT_FILE_NAME, "filename", {
        match: constants.FILE_NAME_REGEX,
        required: true
      })
      .then(filename => {
        if (filename) {
          filename = helpers.removeLineBreaks(filename);
          editorManager.addNewFile(filename, {
            isUnsaved: false
          });
        }
      })
      .catch(err => {
        console.log(err);
      });
  },
  "next-file": function () {
    const len = editorManager.files.length;
    let fileIndex = editorManager.files.indexOf(editorManager.activeFile);

    if (fileIndex === len - 1) fileIndex = 0;
    else ++fileIndex;

    editorManager.switchFile(editorManager.files[fileIndex].id);
  },
  "open": function (page) {
    if (page === 'settings') settingsMain();
    if (page === 'help') help();
    editorManager.editor.blur();
  },
  "open-file": function () {
    editorManager.editor.blur();
    FileBrowser('file', function (uri) {
        const ext = helpers.extname(uri);

        if (appSettings.defaultSettings.filesNotAllowed.includes((ext || '').toLowerCase())) {
          alert(strings.notice.toUpperCase(), `'${ext}' ${strings['file is not supported']}`);
          return false;
        }
        return true;
      })
      .then(res => {
        const {
          url,
          filename
        } = res;

        const createOption = {
          uri: url,
          name: filename
        };
        openFile(createOption);
      })
      .catch(err => {
        if (err.code) {
          alert(strings.error.toUpperCase(), `${strings['unable to open file']}. ${helpers.getErrorMessage(err.code)}`);
        } else if (err.code !== 0) {
          alert(strings.error.toUpperCase(), strings['unable to open file']);
        }
        console.error(err);
      });
  },
  "open-folder": function () {
    editorManager.editor.blur();
    FileBrowser('folder')
      .then(res => {
        const url = res.url;
        const protocol = Url.getProtocol(url);

        if (protocol === "ftp:") {
          return openFolder(res.url, {
            name: res.name,
            reloadOnResume: false,
            saveState: false
          });
        } else {
          return openFolder(res.url, {
            name: res.name
          });
        }

      })
      .then(() => {
        window.plugins.toast.showShortBottom(strings['folder added']);
        editorManager.onupdate();
      })
      .catch(err => {
        if (err.code) {
          alert(strings.error.toUpperCase(), `${strings['unable to open folder']}. ${helpers.getErrorMessage(err.code)}`);
        } else if (err.code !== 0) {
          alert(strings.error.toUpperCase(), strings['unable to open folder']);
        }
      });
  },
  "paste": function () {
    clipboardAction('paste');
  },
  "prev-file": function () {
    const len = editorManager.files.length;
    let fileIndex = editorManager.files.indexOf(editorManager.activeFile);

    if (fileIndex === 0) fileIndex = len - 1;
    else --fileIndex;

    editorManager.switchFile(editorManager.files[fileIndex].id);
  },
  "read-only": function () {
    const file = editorManager.activeFile;
    file.editable = !file.editable;
    editorManager.onupdate();
  },
  "recent": function () {
    recents.select()
      .then(res => {
        if (res.type === 'file') {
          openFile(res.val);
        } else if (res.type === 'dir') {
          openFolder(res.val.url, res.val.opts);
        } else if (res === 'clear') {
          delete localStorage.recentFiles;
          delete localStorage.recentFolders;
          recents.files = [];
          recents.folders = [];
        }
      });
  },
  "rename": function (file) {
    file = file || editorManager.activeFile;
    dialogs.prompt(strings.rename, file.filename, 'filename', {
        match: constants.FILE_NAME_REGEX
      })
      .then(newname => {
        if (!newname || newname === file.filename) return;
        newname = helpers.removeLineBreaks(newname);
        const uri = file.uri;
        if (uri) {
          fsOperation(uri)
            .then(fs => {
              return fs.renameTo(newname);
            })
            .then((newUri) => {
              file.uri = newUri;
              file.filename = newname;

              openFolder.updateItem(uri, newUri, newname);
              window.plugins.toast.showShortBottom(strings['file renamed']);
            })
            .catch(err => {
              helpers.error(err);
              console.error(err);
            });
        } else {
          file.filename = newname;
          if (file.type === 'regular') window.plugins.toast.showShortBottom(strings['file renamed']);
        }
      });
  },
  "replace": function () {
    this.find();
  },
  "resize-editor": function () {
    editorManager.editor.resize(true);
    editorManager.controls.update();
  },
  "run": function () {
    runPreview();
  },
  "save": function (toast) {
    saveFile(editorManager.activeFile, false, toast);
  },
  "save-as": function (toast) {
    saveFile(editorManager.activeFile, true, toast);
  },
  "select-all": function () {
    clipboardAction('select all');
  },
  "select-word": select,
  "select-line": () => select('line'),
  "syntax": function () {
    editorManager.editor.blur();
    Modes()
      .then(mode => {
        const activefile = editorManager.activeFile;
        const ext = path.extname(activefile.filename);

        const defaultmode = modelist.getModeForPath(activefile.filename).mode;
        if (ext !== '.txt' && defaultmode === "ace/mode/text") {
          let modeAssociated;
          try {
            modeAssociated = JSON.parse(localStorage.modeassoc || '{}');
          } catch (error) {
            modeAssociated = {};
          }

          modeAssociated[ext] = mode;
          localStorage.modeassoc = JSON.stringify(modeAssociated);
        }

        activefile.setMode(mode);
      });
  },
  "toggle-quick-tools": function () {
    quickTools.actions("toggle-quick-tools");
    editorManager.controls.vScrollbar.resize();
  },
  "toggle-fullscreen": function () {
    app.classList.toggle("fullscreen-mode");
    this["resize-editor"]();
  },
  "toggle-sidebar": () => {
    editorManager.sidebar.toggle();
  },
  "toggle-menu": () => {
    Acode.$menuToggler.click();
  },
  "toggle-editmenu": () => {
    Acode.$editMenuToggler.click();
  }
};

export default commands;