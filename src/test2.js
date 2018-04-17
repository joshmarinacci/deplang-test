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

   isDirty() {
       return this.dirty
   }
   // markDirty() {
   //     this.dirty = true
   // }
   // markInvalid() {
   //     this.valid = false
   // }
   // getDependents() {
   //     return this.listeners
   // }
   evaluate() {
       if(typeof this.value === 'function') {
           console.log("doing a function")
           const params = this.dependencies.map((o)=>o.evaluate())
           console.log("params",params)
           const val = this.value.apply(null,params)
           console.log("result is",val)
           this.dirty = false
           return val
       }

       const params = this.dependencies.map((o)=>o.evaluate())
       this.dirty = false
       return this.value
   }
   update(value) {
       this.value = value
       this.markDirty()
   }
   // isValid() {
   //     return this.valid
   // }
    markDirty() {
        this.dirty = true
        this.listeners.forEach(l=>l.markDirty())
    }
    dumpChain(prefix) {
       if(!prefix) prefix = ''
       console.log(prefix + this.name,'=',this.value)
        this.dependencies.forEach((d)=>d.dumpChain(prefix+'  '))
    }
}


// test('basic expression evaluation',(t)=>{
//     const code = new Observable("code","1+2")
//     const one = new Observable('one',1)
//     one.dependsOn(code)
//     const two = new Observable('two',2)
//     two.dependsOn(code)
//     const add  = new Observable('addition',function(a,b) { return a+b })
//     add.dependsOn(one,two)
//     t.equals(code.evaluate(),'1+2')
//     t.equals(one.evaluate(),1)
//     t.equals(two.evaluate(),2)
//     t.equals(add.evaluate(),3)
//     t.end()
// })

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

return

test('editing a block of code which eliminates a variable', t =>{
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
    const adef = new Observable('A-def','A')
    adef.dependsOn(code1)
    adef.dependsOn(six)

    symbols.listen('A',adef)
    const block1 = new Observable('block1')
    block1.depends(six,adef,symbols)
    const val1 = new Observable('value1')
    val1.depends(block1)

    //block two is A+5
    const code2 = new Observable('A+5')
    const five = new Observable('five',5)
    five.depends(code2)
    const aref = new Observable('A-ref','A')
    aref.depends(code2)
    aref.depends(symbols)
    const add = new Observable('add',function(a,b){return a+b})
    add.depends(five,aref)
    const block2 = new Observable()
    block2.depends(five,aref,add,symbols)
    const val2 = new Observable()
    val2.depends(block2)

    // the gui updates when anything changes
    const GUI = new Observable('GUI')
    GUI.depends(block1,block2)

    //verify everything works
    t.equals(val1.evaluate(),6)
    t.equals(val2.evaluate(),11)

    //update code to be {7=>B}
    code1.update('{7=>B')
    const seven = new Observable('seven',7)
    seven.depends(code1)
    const bdef = new Observable('B-def','B')
    bdef.depends(code1,seven)

    symbols.listen('B',bdef)
    six.markInvalid()
    adef.markInvalid()
    t.isFalse(val1.isInvalid())
    t.isTrue(block2.isDirty())
    t.isTrue(val2.isDirty())
    t.isTrue(val2.isInvalid())
    t.isTrue(add.isInvalid())
    t.isTrue(add.isDirty())


    //now fix the code
    code1.update('{7=>A}')
    adef.depends(code1,seven)
    t.equals(add.isInvalid(),false)
    t.equals(add.isDirty(),true)
    t.equals(add.evaluate(),12)
    t.equals(add.isDirty(),false)
    t.equals(GUI.isDirty(),true)

    t.equals(GUI.evaluate(),[7,12])

})