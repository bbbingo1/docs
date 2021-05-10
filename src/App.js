import Doc from './Document';
import HyperDoc from './HyperDoc';
import History from './History';
import InlineEditable from './InlineEditable';
import React, { Component, version } from 'react';
// import Automerge from 'automerge';
import { Creatable } from 'react-select';
import 'react-select/dist/react-select.css';
import 'antd/dist/antd.css';
import { Menu, Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons'
import img from './assets/background.png';

function shrinkId(id) {
  if (id.length <= 12) return id;
  let front = id.substring(0, 6);
  let end = id.substring(id.length - 6);
  return `${front}...${end}`;
}

let current = null

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      doc: null,
      docs: [],
      peerIds: {},
      username: '',
      password: '',
      email: '',
      loginType: 1,
      name: props.id.substr(0, 6),
      color: props.colors[parseInt(props.id, 16) % props.colors.length]
    };
  }

  registerPeer(peer, msg) {
    // keep track of peer ids
    let peerIds = this.state.peerIds;
    let id = peer.remoteId.toString('hex');
    peerIds[id] = msg.id;
  }

  registerWithPeer(peer) {
    // tell new peers this peer's id
    this.props.hm._messagePeer(peer, { type: 'hi', id: this.props.id });
  }

  componentDidMount() {
    // update username
    if (current && !this.state.username) {
      this.setState({ username: current.username })
    }
    this.props.hm.on('peer:message', (actorId, peer, msg) => {
      if (msg.type === 'hi') {
        this.registerPeer(peer, msg);
      }
    });

    this.props.hm.on('peer:joined', (actorId, peer) => {
      this.registerWithPeer(peer);
    });

    this.props.hm.on('peer:left', (actorId, peer) => {
      if (this.state.doc && peer.remoteId) {
        // remove the leaving peer from the editor
        let id = peer.remoteId.toString('hex');
        id = this.state.peerIds[id];
        this.state.doc.leave(id);
      }
    });

    // remove self when closing window
    window.onbeforeunload = () => {
      this.state.doc.leave(this.props.id);
    }

    this.props.hm.on('document:updated', () => {
      this.updateDocsList();
    });

    this.props.hm.on('document:ready', () => {
      this.updateDocsList();
    });
  }

  onDocumentReady(doc) {
    // save doc into state
    // save id/name/color into doc
    doc.join(this.props.id, this.state.name, this.state.color);
    doc.on('updated', (doc) => this.setState({ doc }));
    let current = Bmob.User.current()
    this.setState({ doc, name: current.username });
    doc.setName(this.props.id, current.username);
  }

  createDocument() {
    let doc = HyperDoc.new();
    doc.once('ready', this.onDocumentReady.bind(this));
  }

  selectDocument(selected) {
    let docId = selected.value;
    this.openDocument(docId);
  }

  openDocument(docId) {
    try {
      let doc = HyperDoc.open(docId);
      if (doc.ready) {
        this.onDocumentReady(doc);
      } else {
        doc.once('ready', this.onDocumentReady.bind(this));
      }
    } catch (e) {
      console.log(e);
    }
  }

  updateDocsList() {
    let docs = Object.keys(this.props.hm.docs).map((docId) => {
      return { value: docId, label: this.props.hm.docs[docId].title };
    }).filter((d) => d.label);
    this.setState({ docs });
  }

  onEditName(ev) {
    let name = ev.target.value;
    if (name && this.state.doc) {
      this.state.doc.setName(this.props.id, name);
      this.setState({ name: name });
    }
  }

  onEditUsername(ev) {
    let username = ev.target.value;
    if (username) {
      this.setState({ username });
    }
  }

  onEditPassword(ev) {
    let password = ev.target.value;
    if (password) {
      this.setState({ password });
    }
  }

  changeType() {
    this.setState({ loginType: this.state.loginType === 1 ? 2 : 1 });
  }

  submit() {
    const { username, password } = this.state
    const params = { username, password }
    if (this.state.loginType === 1) {
      Bmob.User.login(username, password).then(res => {
        this.setState({ username: res.username });
      }).catch(err => {
        console.log(err)
      });
    } else {
      Bmob.User.register(params).then(res => {
        this.setState({ username: res.username });
      }).catch(err => {
        console.log(err)
      });
    }
  }

  logout() {
    console.log(123)
    Bmob.User.logout()
    this.setState({ username: '' });
    current = null
  }

  saveVersion() {
    console.log(this.state.doc)
    let text = this.state.doc.text
    if (text) {
      this.state.doc.setVersion(this.props.id, text);
    } else {
      alert('fail: currency document text is empty')
    }
  }

  export() {
    let fname = `${this.state.doc.title}.txt`;
    let text = this.state.doc.text;
    let el = document.createElement('a');
    el.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
    el.setAttribute('download', fname);
    el.style.display = 'none';
    document.body.appendChild(el);
    el.click();
    document.body.removeChild(el);
  }

  render() {
    // login section
    if (!current) {
      current = Bmob.User.current()
    }
    const setBackground = {
      backgroundImage: `url(${img})`,
      backgroundRepeat: "repeat"
    }

    // main section
    let main;
    if (this.state.doc) {
      main = (
        <div id='doc'>
          <InlineEditable
            className='doc-title'
            value={this.state.doc.title}
            onEdit={(title) => this.state.doc.title = title} />
          <div>{this.state.doc.nPeers} peers</div>
          <Doc id={this.props.id} doc={this.state.doc} />
          <div className='doc-id'>Copy to share: <span>{this.state.doc.id}</span></div>
          <div className='doc-misc'>
            <button onClick={this.export.bind(this)}>Save as text</button>
          </div>
          <div className='doc-save-history'>
            <button onClick={this.saveVersion.bind(this)}>Save as historical version</button>
          </div>
        </div>
      );
    } else {
      // TODO these should be proper accessible links
      // which support browser history/clicking back
      main = (
        <div>
          <h2 className='initial-title'>Documents</h2>
          <ul id='doc-list'>
            {this.state.docs.map((d) => {
              return <li key={d.value}>
                <a onClick={() => this.openDocument(d.value)}>{d.label}</a>
              </li>;
            })}
          </ul>
        </div>
      );
    }

    // logout
    const menu = (
      <Menu>
        <Menu.Item key="0" onClick={this.logout.bind(this)}>
          <a>sign out</a>
        </Menu.Item>
      </Menu>
    );

    return current ? (<main role='main'>
      <nav>
        <div id='nav-content'>
          <button className='create-button' onClick={this.createDocument.bind(this)}>Create new document</button>
          <input
            type='text'
            placeholder='Name'
            className='app-name'
            value={this.state.name}
            onChange={this.onEditName.bind(this)} />
          <Creatable
            style={{ width: '12em' }}
            placeholder='Open document'
            options={this.state.docs}
            onChange={this.selectDocument.bind(this)}
            promptTextCreator={(label) => `Open '${shrinkId(label)}'`}
          />
          <History doc={this.state.doc} />
        </div>
      </nav>
      <div className="userInfo">
        <Dropdown overlay={menu} trigger={['click']}>
          <a className="ant-dropdown-link" onClick={e => e.preventDefault()}>
            {this.state.username} <DownOutlined />
          </a>
        </Dropdown>
      </div>
      {main}

    </main>) :
      (<div>
        <div id="userLogin" style={setBackground}>
          <div className="wrap">
            <form className="login">
              <p className="title">{this.state.loginType === 1 ? '用户登录' : '用户注册'}</p>
              <input value={this.state.username} type="text" placeholder="请输入账号" autoFocus
                onChange={this.onEditUsername.bind(this)} />
              <i className="fa fa-user"></i>
              <input value={this.state.password} type="password" placeholder="请输入密码"
                onChange={this.onEditPassword.bind(this)} />
              <i className="fa fa-key"></i>
              {/* <input value={this.state.email} type="text" placeholder="请输入邮箱"
                onChange={this.onEditEmail.bind(this)} />
              <i className="fa fa-key"></i> */}
              <a className="change" onClick={this.changeType.bind(this)}>{this.state.loginType === 1 ? '没有账号？点击注册' : '已有账号？点击登录'}</a>
              <a className="button" onClick={this.submit.bind(this)}>
                <span className="state">{this.state.loginType === 1 ? '登录' : '注册'}</span>
              </a>
            </form>
          </div>
        </div>
      </div >)
  }
}

export default App;
