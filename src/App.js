import React, { Component } from 'react';
import './App.css';
import InputPanel from './InputPanel'
import Symbols from "./Symbols"


class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            sources: [
                `6=>A`,
                `Add(op1:A, op2:5)`,
                // `Add(op1:Slider(value:2), op2: 3)`,
                // `4`
            ],
            symbols: new Symbols()
        }
    }
    render() {
        return <div id="main">
            {this.state.sources.map((src,i)=>{
                return <InputPanel key={i} num={i} source={src} symbols={this.state.symbols}/>
            })}
        </div>
    }
}

export default App;
