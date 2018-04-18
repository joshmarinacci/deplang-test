import Observable from './Observable'

export default class Symbols {
    constructor() {
        this._symbols = {}
    }
    _getSymbol(name) {
        if(!this._symbols[name]) {
            this._symbols[name]  = new Observable('symbol',function() {  return arguments[0] })
            this._symbols[name].evaluate = function() {
                // console.log('evaluating!!!!!!!!', this)
                // console.log("referencing",this.dependencies[0].isInvalid())
                if(this.dependencies[0].isInvalid()) {
                    console.log('this symbol is invalid', name)
                    return new Error("invalid symbol")
                } else {
                    return this.dependencies[0].evaluate()
                }
            }
        }
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

    dump() {
        console.log('symbols',this._symbols)
    }

}
