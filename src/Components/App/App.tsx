import React, { Component } from 'react';
import VoxelViewer from '../VoxelViewer/VoxelViewer';
import qs from "qs";
import './App.css';

// const defaultUrl = 'vox/pink_mini_store.vox';
const defaultUrl = 'vox/3x3x3.vox';
export default class App extends Component {

  render() {
    const parsed = qs.parse(location.search, { ignoreQueryPrefix: true });
    const url = (parsed ? parsed.url as string: undefined) || defaultUrl;
    return (
      <div className="App">
        <VoxelViewer src={url} />
      </div>
    );
  }
}
