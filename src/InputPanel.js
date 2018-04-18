import {evalBranch, toAST, toGraph} from './GUtils'
import React, { Component } from 'react';
import ASTView from './ASTView'
import GraphView from './GraphView'
import ValueView from './ValueView'

class Observable {
    constructor(name, value) {
        this.name = name
        this.value = value
        this.listeners = []
        this.dependencies = []
        this.dirty = true
        this.valid = true
    }
    dependsOn() {
        const args = Array.prototype.slice.apply(arguments)
        args.forEach((arg)=>{
            arg.listeners.push(this)
            this.dependencies.push(arg)
        })
    }

    clearDeps() {
        this.dependencies.forEach((arg)=>{
            arg.listeners = arg.listeners.filter(n => n !== this)
        })
        this.dependencies = []
    }

    isDirty() {
        return this.dirty
    }
    isInvalid() {
        return this.invalid
    }
    evaluate() {
        if(typeof this.value === 'function') {
            const params = this.dependencies.map((o)=>o.evaluate())
            // console.log("params",params)
            const val = this.value.apply(null,params)
            // console.log("result is",val)
            this.dirty = false
            this.invalid = false
            return val
        }

        const params = this.dependencies.map((o)=>o.evaluate())
        this.dirty = false
        this.invalid = false
        return this.value
    }
    update(value) {
        this.value = value
        this.markDirty()
    }
    markDirty() {
        this.dirty = true
        this.listeners.forEach(l=>l.markDirty())
    }
    dumpChain(prefix) {
        if(!prefix) prefix = ''
        console.log(prefix + this.name,'=',this.value)
        this.dependencies.forEach((d)=>d.dumpChain(prefix+'  '))
    }

    markInvalid() {
        this.invalid = true
        this.listeners.forEach(l=>l.markInvalid())
    }
}

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
    }
    evaluate = () => {

        //update the code. in reality this will generate new nodes
        console.log("updating code to ", this.state.source)
        this.code.update(this.state.source)
        this.block.clearDeps()

        //mark the old nodes invalid
        //code

        //make the new nodes
        if(this.props.num === 0) {
            const six = new Observable('six',6)
            six.dependsOn(this.code)
            const a_def = new Observable('A-def', EQUALS_LAST)
            a_def.dependsOn(this.code)
            a_def.dependsOn(six)
            this.block.dependsOn(six)
            this.block.dependsOn(a_def)
            this.props.symbols.setSymbolDef('A',a_def)
        }
        if(this.props.num === 1) {
            const a_ref = new Observable('A-ref',EQUALS_LAST)
            a_ref.dependsOn(this.code)
            this.props.symbols.setSymbolRef('A',a_ref)
            const five = new Observable('five', 5)
            five.dependsOn(this.code)
            const add = new Observable('addition', function (a, b) {
                return a + b
            })
            add.dependsOn(a_ref, five)

            this.block.dependsOn(a_ref)
            this.block.dependsOn(five)
            this.block.dependsOn(add)
        }


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
}

