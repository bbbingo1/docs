import { Drawer, Button, Popconfirm, version } from 'antd';
import React, { Component } from 'react';

class History extends Component {
	constructor(props) {
		super(props);
		this.state = {
			visible: false
		};
	}
	showDrawer() {
		this.setState({ visible: true });
	};
	onClose() {
		this.setState({ visible: false });
	};
	handleRollback(value) {
		if (!value) return;
		this.props.doc.coverText(value.text)
		this.onClose()
	}
	render() {
		let list;
		if (this.props.doc && this.props.doc.history) {
			console.log(this.props.doc.history)
			const versions = this.props.doc.history
			list = (<>
				{Object.keys(versions).map((id) => {
					console.log(id, versions[id])
					return (<div className='version-list' key={id}>
						<div className='version-title'>{id}</div>
						<Popconfirm title="Overwrite current version?" placement="left" okText="Yes" cancelText="No" onConfirm={this.handleRollback.bind(this, versions[id])}>
							<a className='version-button'>rollback</a>
						</Popconfirm>
					</div>)
				})}
			</>)
		} else {
			list = (<h2>Please open a document at first</h2>)
		}
		return <div className='history-list'>
			<Button type="primary" onClick={this.showDrawer.bind(this)}>
				Open History List
  		</Button>
			<Drawer
				title="history version"
				placement="right"
				closable={false}
				onClose={this.onClose.bind(this)}
				visible={this.state.visible}
				width='300'
			>
				{list}
			</Drawer></div>;
	}
}

export default History;
