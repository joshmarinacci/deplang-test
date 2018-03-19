import {toAST} from './GUtils'
import React, { Component } from 'react';
import ASTView from './ASTView'

export default class InputPanel extends Component {
    constructor(props) {
        super(props)
        this.state = {
            source:`5=>A Add(op1:A, op2:5)`,
            ast:null,
        }
    }
    evaluate = () =>{
        console.log("evaluating",this.state.source)
        const ast = toAST(this.state.source)
        this.setState({ast:ast})
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
                />
                <button onClick={this.evaluate}>evaluate</button>
                <ASTView ast={this.state.ast}/>
            </div>
        );
    }
}

