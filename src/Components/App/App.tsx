import React, { Component } from 'react';
import VoxelViewer from '../VoxelViewer/VoxelViewer';
import './App.css';

export default class App extends Component {
  render() {
    return (
      <div className="App">
        <VoxelViewer />
      </div>
    );
  }
}
