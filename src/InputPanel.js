import {evalBranch, toAST, toGraph} from './GUtils'
import React, { Component } from 'react';
import ASTView from './ASTView'
import GraphView from './GraphView'
import Graph from "./Graph"
import ValueView from './ValueView'

export default class InputPanel extends Component {
    constructor(props) {
        super(props)
        this.state = {
            source:`5=>A Add(op1:A, op2:5)`,
            ast:null,
            branch:null,
            value:null
        }
    }
    evaluate = () =>{
        console.log("evaluating",this.state.source)
        const ast = toAST(this.state.source)
        const graph = new Graph()
        const branch = toGraph(graph,ast)
        evalBranch(branch).then((val)=>{
            this.setState({value:val})
        })
        this.setState({ast:ast, branch:branch, graph:graph})
    }
    edited = (e)=> this.setState({source:e.target.value})
    keyPressed = (e) => {
        if(e.keyCode === 13 && e.ctrlKey) {
            e.preventDefault()
            this.evaluate()
        }
    }
    render() {
        return (
            <div className={'input-panel'}>
                <textarea value={this.state.source}
                          onChange={this.edited}
                          rows={10} cols={40}
                          onKeyDown={this.keyPressed}
                          className="panel"
                />
                <div className="panel">
                    <button onClick={this.evaluate}>evaluate</button>
                </div>
                <ASTView ast={this.state.ast}/>
                <GraphView graph={this.state.graph}/>
                <ValueView value={this.state.value}/>
            </div>
        );
    }
}

