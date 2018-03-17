const ohm = require('ohm-js')

const test = require('tape')
const Graph = require('./Graph')
const util = require('util')
/*
ex1:
---
    8 => A
---
    9 => B
    add(A,B)
---

each block should turn the whole tree into a parallel tree of inputs

8 becomes a text field
A becomes a label
8 => A becomes an output span showing the current value
9 becomes a text field
B becomes a label
9 => B becomes an output span
add(A,B) becomes a label w/ an eval button on it and an output span

Slider(value:8) => A  becomes a slider with the value 8, attached to a label, and with an output span

[1,2,3,4,5] => data  becomes a small table of data and the label data and the output span

Sum(data) becomes a funcall label with a button to look up the def & docs of sum, and an output span


source => AST => graph => input and output panels


success should be able to do the following:

all arithmetic with numbers (no units yet) that can update when the code changes and I press update button
4*5+7   prints tree and literal 27
Slider(4)*5+7 prints tree and slider and literal 27. update live

5 = A
A+5
update A by changing the code.

drawSin(Slider(value:5, min:0, max:10))  produces function that can draw onto the canvas based on the current slider value

Random(period:1000)  produces label that updates to a random value (0->1) every second

Midi => Osc => ADSR => Sound



* create graph. stored at the app level and passed into the input panel as a prop
* evaluate the first block. creates literal and symbolref nodes
* evaluate the second block. creates the literal and symbolref nodes, and expression node
* send to output panel
* resolves the value for the second block. produces the literal number 15
* render the 15 in the output panel's output
* edit the second block and evaluate.
* remove the previous literal and symbolref nodes
* add new literal and symbol ref nodes
* mark that the graph has changed
* second output panel is notified of a change. resolves the value again. should get a new value.

*/


// const src = `5=>A Add(A,5)`
//convert to AST
//convert to graph
//eval graph
//print graph w/ current values
//update the value of A
//get event that something in the block was updated
//eval graph
//print graph w/ current values

// const src1 = `5=>A`; const src2 = `Add(A,5)`
//convert both to ASTs
//convert both to graph branches in the same graph
//eval both graph branches
//print both branches w/ current values
//change to 6=>A and update that branch
//branch 2 should get event that something was updated
//eval both graph branches
//print both branches w/ current values


const PREDEFINED_FUNCTIONS = {
    'Image': function(ctx, args) {
        console.log(`Making Image with size ${args.width}x${args.height}`)
        const canvas = document.createElement('canvas')
        canvas.width = args.width
        canvas.height = args.height
        return canvas
    },
    'Circle': function(ctx, args) {
        return {
            type:'circle',
            cx:args.cx,
            cy:args.cy,
            radius:args.radius,
            fill:args.fill
        }
    },
    'Draw': function(ctx, args) {
        console.log("pretending to draw")
        let shape= args.shapes
        let image = args.image
        if(!image) image = args.input
        if(!image) throw new Error("no image for the draw command")
        console.log("  shapes", shape)
        console.log("  image",image)

        const c = image.getContext('2d')

        const cir = shape
        // c.fillRect(0,0,25,25)
        c.fillStyle = cir.fill
        c.beginPath()
        c.arc(cir.cx,cir.cy,cir.radius, 0, 360)
        c.closePath()
        c.fill()
        return image
    },
    'Save': function (ctx, args) {
        console.log("pretending to save ")
        console.log("  file ", args.filename)
        console.log("  image", args.input)
        return { type:'save-output'}
    },
    'Slider': function(ctx, args) {
        console.log("making a slider")
        return {
            type:'input',
            kind:'slider',
            min:0,
            max:100,
            value: 20,
            targetNode:ctx.node.id
        }
    },
    'Add': function(ctx, args) {
        console.log('adding numbers together',args.o)
        return {
            type:'literal',
            value:args.op1 + args.op2
        }
    }
}


function toAST(src) {

    const grammar = ohm.grammar(`
        BasicSyntax {
            Block = Statement+
            Statement = Expr ("=>" Expr)*
            Expr = FunCall | String | Number | identifier
            Parameter = identifier ":" Expr
            identifier = letter (letter|digit)*
            String = "'" (~"'" any)* "'"
            Number = digit+
            FunCall = identifier "(" Arguments ")"
            Arguments = ListOf<Parameter, ",">
        }
    `)

    console.log('converting',src)
    const match = grammar.match(src)
    console.log('match is',match.succeeded())
    const sem = grammar.createSemantics().addOperation('toAST', {
        Number: (a) => { return { type:'literal', value:parseInt(a.sourceString) } },
        String: (_q1,str,_q2)  => { return { type:'literal', value:str.sourceString} },
        identifier: function(str, rest) { return { type:'identifier', value: this.sourceString }},
        Arguments: (a) => a.asIteration().toAST(),
        Statement: function(first, _, rest) {
            const chs = [first.toAST()].concat(rest.toAST())
            return {
                type:'statement',
                parts:chs,
            }
        },
        Parameter: (id, _, expr) => ({ type:'parameter', name:id.sourceString, value:expr.toAST() }),
        FunCall: function(id, op, params, cp) {
            return {
                type:'funcall',
                id:id.toAST(),
                params:params.toAST()
            }
        },
        Block: function(statements) {
            return {
                type:'block',
                statements: statements.toAST()
            }
        }
        })
    const ret = sem(match).toAST()
    return ret
}

function toGraphX(graph, root) {
    const set = new Set()
    const ret = toGraph(graph, root, set)
    const branch = {
        type: 'branch',
        root: ret,
        nodes: set,
        listeners: [],
        nodeChanged: function (n) {
            this.listeners.forEach(l => l(n))
        },
        onChange: function (l) {
            this.listeners.push(l)
        }
    }
    function chg(n) {
        branch.nodeChanged(n)
    }
    graph.onChange(chg)
    return branch
}


function toGraph(graph, ast, set) {
    // console.log('adding the ast',ast,'to the graph',graph)
    if(ast.type === 'block') {
        const rets = ast.statements.map((a)=>toGraph(graph,a,set))
        return rets[rets.length-1]
    }
    if(ast.type === 'statement') {
        const rets = ast.parts.map((a)=>toGraph(graph,a,set))
        console.log("need to bind the statement",ast.parts.length)
        if(ast.parts.length >= 2) {
            for(let i=0; i<ast.parts.length-1; i++) {
                const A = ast.parts[i]
                const B = ast.parts[i+1]
                console.log("adding connection for ",A,' => ',B)
                if(B.type === 'identifier') {
                    graph.SYMBOLS[B.value] = A
                    console.log(`setting the symbol ${B.value} to `, A)
                }
            }
        }
        return rets[rets.length-1]
    }
    if(ast.type === 'literal') {
        const ret = graph.makeLiteral(ast.value+"",ast.value)
        set.add(ret)
        return ret
    }
    if(ast.type === 'parameter') {
        return toGraph(graph,ast.value,set)
    }
    if(ast.type === 'identifier') {
        const ret = graph.makeSymbolReference(ast.value)
        set.add(ret)
        return ret
    }

    if(ast.type === 'funcall') {
        const ret = graph.makeExpression(ast.id.value)
        set.add(ret)
        ast.params.forEach((arg)=>{
            const ret2 = toGraph(graph,arg,set)
            graph.add(ret2,ret,arg.name)
        })
        return ret
    }
    throw new Error(`unknown AST node type: ${ast.type} `)
}


//TODO: we need a real branch object which has a reference to every graph node created for that branch
//TODO: then we can print the branch for real
//TODO: resolve will use promises to create the values. sets the 'lastValue' on each graph node for printing purposes

function evalBranch(branch){
    // console.log('evaluating the branch', branch)
    return resolveValue(branch.root)
}

function resolveValue(node) {
    // console.log(`resolving ${node.type}`)
    if(node.type === 'literal') return Promise.resolve(node.value)
    if(node.type === 'symbolref') {
        return new Promise((res,rej)=>{
            // console.log("looking up symbol", node, node.graph.SYMBOLS)
            const expr = node.graph.SYMBOLS[node.name]
            if(!expr) rej(new Error("symbol not defined: " + node.name, node))
            resolveValue(expr).then((ret)=>{
                res(ret)
            })
        })
    }
    if(node.type === 'expression') {
        return new Promise((res, rej) => {
            //it must be an expression
            const proms = Object.keys(node.inputs).map((key) => resolveValue(node.inputs[key]))
            return Promise.all(proms).then((rets) => {
                const args = {}
                Object.keys(node.inputs).forEach((key, i) => args[key] = rets[i])//resolveValue(node.inputs[key]))
                const fun = PREDEFINED_FUNCTIONS[node.name]
                console.log("calling function with node",node.id)
                if (fun) res(fun({node:node}, args))
                rej(new Error(`no defined function ${node.name}`))
            })
        })
    }
    throw new Error("got down here. bad")
}

function printBranch(branch) {
    // console.log("printing the branch", branch)
    console.log("====")
    branch.nodes.forEach((obj)=>{
        // console.log("obj",obj)
        if(obj.type === 'symbolref') console.log(`Sym: ${obj.value} ${obj.id}`)
        if(obj.type === 'literal') console.log(`Lit: ${obj.value}`)
        if(obj.type === 'expression') {
            const inps = Object.keys(obj.inputs).map((inp)=>{
                return inp+": "+obj.inputs[inp].name
            })
            console.log(`Exp: ${obj.name} ${inps.join(" ")}`)
        }
    })
}

test('single branch',(t) => {
    const srcs=[`5=>A Add(op1:A, op2:5) `]// Add(A,5)
    const asts = srcs.map(toAST)
    // console.log(util.inspect(asts, {depth:10}))
    const graph = new Graph()
    const branches = asts.map((ast)=>toGraphX(graph,ast))
    // console.log(util.inspect(branches, {depth:10}))
    branches.map(printBranch)

    branches[0].onChange(()=>{
        console.log("the branch changed")
        evalBranch(branches[0]).then((val)=>{
            console.log('new value is', val)
            t.equal(val.value,11)
            t.end()
        })
    })

    Promise.all(branches.map(evalBranch)).then((vals)=>{
        console.log("resolved to values",vals)
        t.equal(vals[0].value,10)
        graph.setSymbolValue('A',{type:'literal', value:6})
    })
})


test('double branch',(t) =>{
    const srcs=[`5=>A`,`Add(op1:A,op2:5)`]
    const asts = srcs.map(toAST)
    const graph = new Graph()
    const branches = asts.map((ast)=>toGraphX(graph,ast))
    branches.map(printBranch)

    branches[1].onChange(()=>{
        console.log("second branch changed")
        evalBranch(branches[1]).then((val)=>{
            console.log("the new value is",val)
            t.equal(val.value,11)
            t.end()
        })
    })
    Promise.all(branches.map(evalBranch)).then((vals)=>{
        console.log("branches resolved to ",vals)
        t.equals(vals[1].value,10)
        graph.setSymbolValue('A',{type:'literal',value:6})
    })
})

return

test('random walk',t => {
    const srcs = [`Random() => A`]
    const asts = srcs.map(toAST)
    const graph = new Graph()
    const branches = asts.map((ast)=>toGraph(graph,ast))
    branches.map(evalBranch)
    branches.map(printBranch)

    let count = 0
    branches[0].onChange(()=>{
        console.log("value changed")
        const val = evalBranch(branches[0])
        console.log('new value is', val)
        count++
        if(count === 3) {
            t.end()
            branches.map(stopBranch)
        }
    })

    branches.map(startBranch)
})

test('slider',t=>{
    const srcs = [`Add(Slider(uuid:1,value:5),6)`]
    const asts = srcs.map(toAST)
    const graph = new Graph()
    const branches = asts.map((ast)=>toGraph(graph,ast))
    branches.map(evalBranch)
    branches.map(printBranch)
    branches[0].onChange(()=> {
        console.log("value changed")
        const val = evalBranch(branches[0])
        console.log('new value is', val)
        t.equal(val,14)
        t.end()
    })
    graph.setSliderValue(1,8)
})

test('fake midi',t => {
    const srcs=[`Sound(signal:ADSR(input:Osc(freq:MIDI()), attack:1, decay:1, sustain:1, release:1))`]
    const asts = srcs.map(toAST)
    const graph = new Graph()
    const branches = asts.map((ast)=>toGraph(graph,ast))
    branches.map(evalBranch)
    branches.map(printBranch)
    branches[0].onChange(()=>{
        const val = evalBranch(branches[0])
        console.log('value changed to ', val)
        count++
        if(count === 3) {
            t.end()
            branches.map(stopBranch)
        }
    })
    branches.map(startBranch)
})