import React, { Component } from 'react';
import VoxelViewer from '../VoxelViewer/VoxelViewer';
import qs from "qs";
import './App.css';

const defaultUrl = 'vox/pink_mini_store.vox';

interface AppProps {
}

interface AppState {
  src?: string;
} 

function parseHash() {
  const parsed = qs.parse(location.hash.substring(1)) as Partial<AppState>;
  console.log("App State from Hash", parsed);
  return parsed;
}

export default class App extends React.Component<AppProps, AppState> {

  constructor(props: AppProps) {
    super(props);
    this.state = {
      ...parseHash()
    };
  }

  hashChanged() {
    this.setState({
      ...parseHash()
    });
  }

  componentDidMount() {
    window.addEventListener("hashchange", () => this.hashChanged(), false);
  }

  componentWillUnmount() {
    window.removeEventListener("hashchange", () => this.hashChanged(), false);
  }

  render() {
    const src = this.state.src || defaultUrl;
    return (
      <div className="App">
        <VoxelViewer {...(this.state as any)} src={src}
          onFileChange={(src:string) => {
            location.hash = qs.stringify({ ...parseHash(), src });
          }} />
      </div>
    );
  }
}

