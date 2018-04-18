import React, { Component } from 'react';
import './App.css';
import InputPanel from './InputPanel'
import Graph from "./Graph"


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
            console.log("params",params)
            const val = this.value.apply(null,params)
            console.log("result is",val)
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

class Symbols {
    constructor() {
        this._symbols = {}
    }
    _getSymbol(name) {
        if(!this._symbols[name]) this._symbols[name]
            = new Observable('symbol',function() { return arguments[0] })
        return this._symbols[name]
    }
    setSymbolDef(name,ob) {
        const sym = this._getSymbol(name)
        sym.clearDeps()
        sym.dependsOn(ob)
    }
    isSymbolDirty(name) {
        const sym = this._getSymbol(name)
        return sym.isDirty()
    }
    evaluateSymbol(name) {
        const sym = this._getSymbol(name)
        return sym.evaluate()
    }
    setSymbolRef(name,ob) {
        const sym = this._getSymbol(name)
        ob.dependsOn(sym)
    }

}

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            sources: [
                `6=>A`,
                `A+5`,
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
