import App from './App';
import React from 'react';
import HyperDoc from './HyperDoc';
import Hypermerge from 'hypermerge';
import ram from 'random-access-memory';
import {render} from 'react-dom';

// const path = 'docs';
const path = ram; // random store

// define global colors
const colors = [
  '#1313ef',
  '#ef1321',
  '#24b554',
  '#851fd3',
  '#0eaff4',
  '#edc112',
  '#7070ff'
];


// Creates a new Hypermerge instance that manages a set of documents.
// All previously opened documents are automatically re-opened.
const hm = new Hypermerge({
  path: path // directory where the documents should be stored
});

hm.once('ready', (hm) => {
  // window.hm = hm 

  // Joins the network swarm for all documents managed by this Hypermerge instance
  // 实现原理：discovery-swarm：使用发现通道查找，并连接到对等方的网络群 A network swarm that uses discovery-channel to find and connect to peers.
  // This module implements peer connection state and builds on discovery-channel which implements peer discovery. This uses TCP sockets by default and has experimental support for UTP.
  hm.joinSwarm({utp: false});  // options refenced by https://github.com/mafintosh/discovery-swarm

  const id = hm.swarm.id.toString('hex');
  console.log(`My ID: ${id}`);

  // ugh hacky
  HyperDoc.hm = hm;

  // render dom
  const main = document.getElementById('main');
  render(<App hm={hm} id={id} colors={colors} />, main);
});
