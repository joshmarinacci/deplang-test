const test = require('tape')

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

test('basic expression evaluation',(t)=>{
    const code = new Observable("code","1+2")
    const one = new Observable('one',1)
    one.dependsOn(code)
    const two = new Observable('two',2)
    two.dependsOn(code)
    const add  = new Observable('addition',function(a,b) { return a+b })
    add.dependsOn(one,two)
    t.equals(code.evaluate(),'1+2')
    t.equals(one.evaluate(),1)
    t.equals(two.evaluate(),2)
    t.equals(add.evaluate(),3)
    t.end()
})


/*
an object def defines a symbol's value
the symbol table should depend on the object def
when an object def becomes dirty it should mark
that symbol in the table as dirty.

an object ref refers to a symbols value
the symbol table should propagate dirty changes
to the

 */

test('propagating dirty changes',t=>{
    const A = new Observable('A','A')
    const B = new Observable('B','B')
    B.dependsOn(A)

    //both should be dirty at first
    t.true(A.isDirty())
    t.true(B.isDirty())

    //evaluate B and both should be clean, B should evaluate to 'B'
    t.equals(B.evaluate(),'B')
    t.false(A.isDirty())
    t.false(B.isDirty())

    //update A to the value 'C'
    A.update('C')

    //now A and B should be dirty
    t.true(A.isDirty())
    t.true(B.isDirty())

    //evaluate B and both should be clean
    t.equals(B.evaluate(),'B')
    t.false(A.isDirty())
    t.false(B.isDirty())

    t.end()
})

test('evaluate using a symbol reference',(t) => {
    const code = new Observable('code','4=>A')
    const four = new Observable('four',4)
    const symbols = new Symbols()
    four.dependsOn(code)
    const A_def = new Observable('symbol-def-A',function() { return arguments[0]})
    A_def.dependsOn(four)
    symbols.setSymbolDef('A',A_def)

    t.true(symbols.isSymbolDirty('A'))
    symbols._getSymbol('A').dumpChain()
    t.equals(symbols.evaluateSymbol('A'),4)
    t.false(symbols.isSymbolDirty('A'))

    const A_ref = new Observable('symbol-ref-A',function() { return arguments[0]})
    symbols.setSymbolRef('A',A_ref)
    t.true(A_ref.isDirty())
    t.equals(A_ref.evaluate(),4)
    t.false(A_ref.isDirty())



    //now update code and four
    code.update('5=>A')
    t.true(code.isDirty())
    t.true(four.isDirty())
    four.update(5)
    t.true(A_ref.isDirty())
    t.equals(A_ref.evaluate(),5)
    t.end()
})


test('editing a block of code which eliminates a variable', t =>{
    const EQUALS_FIRST = function() { return arguments[0]}
    const EQUALS_LAST = function() { return arguments[arguments.length-1]}
    const EQUALS_ALL = function() {
        return Array.prototype.slice.call(arguments)
    }
    // {6=>A}, {A+5}
    // change it to 7=>B
    // verify invalid
    // change it to 7=>A
    // verify it's valid again
    const symbols = new Symbols()


    //block one is 6=>A
    const code1 = new Observable('code1','{6=>A}')
    const six = new Observable('six',6)
    six.dependsOn(code1)
    const adef = new Observable('A-def',EQUALS_LAST)
    adef.dependsOn(code1)
    adef.dependsOn(six)

    t.equals(adef.evaluate(),6)

    symbols.setSymbolDef('A',adef)

    const block1 = new Observable('block1',EQUALS_FIRST)
    block1.dependsOn(six)
    block1.dependsOn(adef)
    const val1 = new Observable('value1',EQUALS_FIRST)
    val1.dependsOn(block1)

    //block two is A+5
    const code2 = new Observable('A+5')
    const five = new Observable('five',5)
    five.dependsOn(code2)
    const aref = new Observable('A-ref',EQUALS_LAST)
    aref.dependsOn(code2)
    symbols.setSymbolRef('A',aref)

    t.equals(aref.evaluate(),6)

    const add = new Observable('add',function(a,b){return a+b})
    add.dependsOn(five,aref)
    const block2 = new Observable('block2',EQUALS_LAST)
    block2.dependsOn(five)
    block2.dependsOn(aref)
    block2.dependsOn(add)
    const val2 = new Observable('value2',EQUALS_FIRST)
    val2.dependsOn(block2)

    // the gui updates when anything changes
    const GUI = new Observable('GUI',EQUALS_ALL)
    GUI.dependsOn(block1)
    GUI.dependsOn(block2)

    //verify everything works
    t.equals(val1.evaluate(),6)
    t.equals(val2.evaluate(),11)


    //update code to be {7=>B}
    // code1.markInvalid() could this replace the six and adef mark invalids?
    code1.update('{7=>B}')
    block1.clearDeps()
    //mark the old nodes invalid
    six.markInvalid()
    adef.markInvalid()
    //make the new ones
    const seven = new Observable('seven',7)
    seven.dependsOn(code1)
    const bdef = new Observable('B-def',EQUALS_LAST)
    bdef.dependsOn(code1)
    bdef.dependsOn(seven)
    block1.dependsOn(seven)
    block1.dependsOn(bdef)
    symbols.setSymbolDef('B',bdef)

    //the old nodes are invalid, but val1 should still be valid
    t.true(six.isInvalid())
    t.true(adef.isInvalid())
    t.false(val1.isInvalid())


    //val1 and val2 should both be dirty, though
    t.true(val1.isDirty())
    t.true(val2.isDirty())

    //add should be invalid, because it depends on something invalid
    t.true(add.isInvalid())
    t.true(add.isDirty())


    //now fix the code
    code1.update('{7=>A}')
    block1.clearDeps()
    //make the old nodes invalid
    seven.markInvalid()
    bdef.markInvalid()
    //make the new nodes
    const seven_b = new Observable('seven-b',7)
    seven_b.dependsOn(code1)
    const adef_b = new Observable('A-def',EQUALS_LAST)
    adef_b.dependsOn(code1)
    adef_b.dependsOn(seven_b)
    block1.dependsOn(seven_b)
    block1.dependsOn(adef_b)
    symbols.setSymbolDef('A',adef_b)


    t.true(add.isDirty())
    t.equals(add.isInvalid(),true)
    t.equals(add.evaluate(),12)
    t.equals(add.isInvalid(),false)
    t.equals(add.isDirty(),false)
    t.equals(GUI.isDirty(),true)

    t.deepEqual(GUI.evaluate(),[7,12])
    return t.end()

})