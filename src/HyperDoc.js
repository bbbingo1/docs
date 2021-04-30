import crypto from 'crypto';
import Automerge from 'automerge';
import EventEmitter from 'events';

function DUMMY(changeDoc) {
  let id = crypto.randomBytes(32).toString('hex');
  changeDoc.text.insertAt(0, ...['a', 'b', 'c', 'd', 'e', 'f']);
  changeDoc.comments[id] = {
    id: id,
    start: 0,
    end: 5,
    resolved: false,
    thread: [{
      id: crypto.randomBytes(32).toString('hex'),
      created: Date.now(),
      author: 'Francis',
      body: 'This is a test comment'
    }, {
      id: crypto.randomBytes(32).toString('hex'),
      created: Date.now(),
      author: 'Frank',
      body: 'This is my response'
    }]
  };
}

Date.prototype.Format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1, // 月份
    "d+": this.getDate(), // 日
    "h+": this.getHours(), // 小时
    "m+": this.getMinutes(), // 分
    "s+": this.getSeconds(), // 秒
    "q+": Math.floor((this.getMonth() + 3) / 3), // 季度
    "S": this.getMilliseconds() // 毫秒
  };
  if (/(y+)/.test(fmt))
    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
  return fmt;
}

class HyperDoc extends EventEmitter {
  constructor(doc) {
    super();

    // ugh hacky
    this.hm = HyperDoc.hm;

    if (doc) {
      this._setDoc(doc);
    } else {
      this.ready = false;
    }
    this.diffs = [];

    this.hm.on('document:updated', this._onUpdate.bind(this));
  }

  static new() {
    let hyd = new HyperDoc();
    this.hm.create();
    this.listenForDoc(hyd);
    return hyd;
  }

  static open(id) {
    if (this.hm.has(id)) {
      let doc = this.hm.find(id);
      return new HyperDoc(doc);
    } else {
      let hyd = new HyperDoc();
      this.hm.open(id);
      this.listenForDoc(hyd);
      return hyd;
    }
  }

  static listenForDoc(hyd) {
    this.hm.once('document:ready', (docId, doc, prevDoc) => {
      doc = this.hm.change(doc, (changeDoc) => {
        if (!changeDoc.text) {
          changeDoc.text = new Automerge.Text();
          changeDoc.title = 'Untitled';
          changeDoc.peers = {};
          changeDoc.comments = {};
          changeDoc.history = {};

          // TODO TESTING
          // DUMMY(changeDoc);
        }
      });

      hyd._setDoc(doc);
      hyd.emit('ready', hyd);
    });
  }

  _setDoc(doc) {
    this.doc = doc;
    this.id = this.hm.getId(doc);
    this.ready = true;
  }

  get peers() {
    return this.doc.peers;
  }

  get nPeers() {
    return Object.keys(this.doc.peers).length;
  }

  get text() {
    return this.doc.text.join('');
  }

  get title() {
    return this.doc.title;
  }

  set title(title) {
    this._changeDoc((changeDoc) => {
      changeDoc.title = title;
    });
  }

  get history() {
    return this.doc.history;
  }

  get comments() {
    return this.doc.comments;
  }

  _changeDoc(changeFn) {
    this.doc = this.hm.change(this.doc, changeFn);
    this.emit('updated', this);
  }

  _onUpdate(docId, doc, prevDoc) {
    if (this.id == docId) {
      let diff = Automerge.diff(prevDoc, doc);
      this.lastDiffs = diff.filter((d) => d.type === 'text');
      this.doc = doc;
      this.emit('updated', this);
    }
  }

  setSelection(peerId, caretPos, caretIdx) {
    // update peers about caret position
    this._changeDoc((changeDoc) => {
      changeDoc.peers[peerId].pos = caretPos;
      changeDoc.peers[peerId].idx = caretIdx;
    });
  }

  setName(peerId, name) {
    this._changeDoc((changeDoc) => {
      changeDoc.peers[peerId].name = name;
    });
  }

  setVersion(peerId, text) {
    const time = new Date().Format("yyyy-MM-dd hh:mm:ss");
    this._changeDoc((changeDoc) => {
      changeDoc.history[time] = {
        operatePeer: peerId,
        text
      }
    });
  }

  coverText(versionText) {
    this._changeDoc((changeDoc) => {
      const length = changeDoc.text.length
      changeDoc.text.deleteAt(0, length)
      changeDoc.text.insertAt(0, ...versionText);
    });
  }

  editText(edits) {
    this._changeDoc((changeDoc) => {
      edits.forEach((e) => {
        if (e.inserted) {
          changeDoc.text.insertAt(e.caret, ...e.changed);
        } else {
          for (let i = 0; i < e.diff; i++) {
            changeDoc.text.deleteAt(e.caret);
          }
        }

        // update comment positions as well
        Object.values(changeDoc.comments).forEach((c) => {
          if (e.caret < c.start + 1) {
            if (e.inserted) {
              c.start++;
            } else {
              c.start--;
            }
          }

          if (e.caret < c.end) {
            if (e.inserted) {
              c.end++;
            } else {
              c.end--;
            }
          }
        });
      });
    });
  }

  join(id, name, color) {
    this._changeDoc((changeDoc) => {
      changeDoc.peers[id] = {
        id: id,
        name: name,
        color: color
      };
    });
  }

  leave(id) {
    this._changeDoc((changeDoc) => {
      delete changeDoc.peers[id];
    });
  }

  addComment(peerId, threadId, body, start, end) {
    if (!body) return;
    this._changeDoc((changeDoc) => {
      // TODO ideally this uses persistent id or sth
      let name = changeDoc.peers[peerId].name;
      let commentId = crypto.randomBytes(32).toString('hex');
      let comment = {
        id: commentId,
        created: Date.now(),
        author: name,
        body: body
      };
      if (threadId) {
        changeDoc.comments[threadId].thread.push(comment);
      } else {
        threadId = crypto.randomBytes(32).toString('hex');
        changeDoc.comments[threadId] = {
          id: threadId,
          start: start,
          end: end,
          resolved: false,
          thread: [comment]
        };
      }
    });
  }

  resolveComment(threadId) {
    this._changeDoc((changeDoc) => {
      changeDoc.comments[threadId].resolved = true;
    });
  }
}

export default HyperDoc;
