import React, { Component } from 'react';
import './App.css';
import InputPanel from './InputPanel'
import Graph from "./Graph"

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            sources: [
                `1 => A`,
                `Add(op1:Slider(value:2), op2: 3)`,
                `4`
            ],
            graph: new Graph()
        }
    }
    render() {
        return <div id="main">
            {this.state.sources.map((src,i)=>{
                return <InputPanel key={i} source={src} graph={this.state.graph}/>
            })}
        </div>
    }
}

export default App;
