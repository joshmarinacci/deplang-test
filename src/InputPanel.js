import {evalBranch, toAST, toGraph} from './GUtils'
import React, { Component } from 'react';
// import ASTView from './ASTView'
// import GraphView from './GraphView'
import ValueView from './ValueView'
import Observable from './Observable'

const EQUALS_FIRST = function() { return arguments[0]}
const EQUALS_LAST = function() { return arguments[arguments.length-1]}

export default class InputPanel extends Component {
    constructor(props) {
        super(props)
        this.state = {
            source: props.source,
            value:0
        }
        this.code = new Observable('code',this.state.source)
        this.block = new Observable('block',EQUALS_LAST)
        this.val = new Observable('val',EQUALS_LAST)
        this.val.dependsOn(this.block)
        this.nodes = []
    }
    makeLiteral(val) {
        const lit = new Observable('lit',val)
        lit.dependsOn(this.code)
        this.block.dependsOn(lit)
        return lit
    }

    makeSymbolDef(value, name) {
        const a_def = new Observable('symbol-def', EQUALS_LAST)
        a_def.dependsOn(this.code)
        a_def.dependsOn(value)
        this.block.dependsOn(a_def)
        this.props.symbols.setSymbolDef(name,a_def)
        return a_def
    }

    evaluate = () => {
        console.log("parsing the code to make observables")
        //update the code. in reality this will generate new nodes
        console.log("updating code to ", this.state.source)
        const ast = toAST(this.state.source)
        this.code.update(this.state.source)
        this.block.clearDeps()
        //mark the old nodes invalid
        this.nodes.forEach(n => n.markInvalid())
        this.makeNodes(ast)
        // this.val.dumpChain()
        // this.props.symbols.dump()
        this.setState({value:this.val.evaluate()})
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
                          rows={4} cols={40}
                          onKeyDown={this.keyPressed}
                          className="panel"
                />
                <div className="panel">
                    <button onClick={this.evaluate}>evaluate</button>
                </div>
                <ValueView value={this.state.value}/>
            </div>
        );
    }

    makeSymbolRef(name) {
        const a_ref = new Observable('symbol-ref',EQUALS_LAST)
        a_ref.dependsOn(this.code)
        this.props.symbols.setSymbolRef(name,a_ref)
        this.block.dependsOn(a_ref)
        return a_ref
    }

    makeAddFunction(A, B) {
        console.log("making an add function for",A,B)
        const add = new Observable('addition', function (a, b) {
            return a + b
        })
        add.dependsOn(A,B)
        this.block.dependsOn(add)
        return add
    }

    makeNodes(ast) {
        // console.log("looking at node",ast)
        if(ast.type === 'block') ast.statements.forEach((a)=>this.makeNodes(a))
        if(ast.type === 'statement') {
            if(ast.parts.length === 1) {
                console.log("single part statement")
                return this.makeNodes(ast.parts[0])
            }
            if(ast.parts[0].type === 'literal'
                && ast.parts[1].type === 'identifier') {
                console.log("this is an assignment")
                const lit = this.makeNodes(ast.parts[0])
                console.log("value = ", lit)
                this.nodes.push(lit)
                const def = this.makeSymbolDef(lit,ast.parts[1].value)
                console.log("def = ", def)
                this.nodes.push(def)
            }
        }

        if(ast.type === 'literal') {
            const lit = this.makeLiteral(ast.value)
            this.nodes.push(lit)
            return lit
        }

        if(ast.type === 'funcall') {
            console.log("it is a function call")
            const params = ast.params.map((p)=>this.makeNodes(p))
            const id = ast.id.value
            // console.log("making function",id,params)
            const add = this.makeAddFunction(params[0].value, params[1].value)
            this.nodes.push(add)
            return add
        }

        if(ast.type === 'parameter') {
            // console.log("parameter name",ast.name)
            // console.log("value",ast.value)
            const value = this.makeNodes(ast.value)
            return {
                name:ast.name,
                value:value
            }
        }
        if(ast.type === 'identifier') {
            console.log("making a symbol ref")
            const a_ref = this.makeSymbolRef(ast.value)
            this.nodes.push(a_ref)
            return a_ref
        }
    }
}

