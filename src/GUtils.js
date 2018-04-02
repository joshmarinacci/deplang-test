import ohm  from 'ohm-js'

const PREDEFINED_FUNCTIONS = {
    'Image': function(ctx, args) {
        // console.log(`Making Image with size ${args.width}x${args.height}`)
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
        // console.log("making a slider", args.value, ctx.getStorageValue('value'))
        if (!ctx.hasStorageValue('value')) {
            ctx.setStorageValue('value', args.value)
        }
        ctx.createUIComponent({
            type:'slider',
            min:0,
            max:100,
            id:ctx.node.id,
            value:ctx.getStorageValue('value')
        })
        return ctx.getStorageValue('value')
        // return {
        //     type: 'literal',
        //     value: ctx.getStorageValue('value')
        // }
    },
    'Add': function(ctx, args) {
        // console.log('adding numbers together',args)
        return {
            type:'literal',
            value:args.op1 + args.op2
        }
    },
    'Random': function(ctx,args) {
        console.log('generating a random number')
        return {
            type:'literal',
            value:Math.random()
        }
    }
}


// const STARTABLE = {
//     'Random':{
//         start: function(node) {
//             console.log("starting the random stream",node)
//             this.intervalid = setInterval(function(){
//                 console.log('triggering')
//                 node.graph.markNodeDirty(node)
//             },1000)
//         },
//         stop: function() {
//             console.log("stopping the random stream")
//             clearInterval(this.intervalid)
//         }
//     }
// }



export const toAST = function (src) {

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
        Number: (a) => { return { type:'literal', value:parseInt(a.sourceString,10) } },
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


export const toGraph = function (graph, root) {
    const set = new Set()
    const ret = convertToGraph(graph, root, set)
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


function convertToGraph(graph, ast, set) {
    // console.log('adding the ast',ast,'to the graph',graph)
    if(ast.type === 'block') {
        const rets = ast.statements.map((a)=>convertToGraph(graph,a,set))
        return rets[rets.length-1]
    }
    if(ast.type === 'statement') {
        const rets = ast.parts.map((a)=>convertToGraph(graph,a,set))
        console.log("need to bind the statement",rets.length)
        if(rets.length >= 2) {
            for(let i=0; i<rets.length-1; i++) {
                const A = rets[i]
                const B = rets[i+1]
                console.log(`adding connection for ${A} => ${B} `)
                if(B.type === 'identifier' || B.type === 'symbolref') {
                    graph.SYMBOLS[B.value] = A
                    console.log(`setting the symbol ${B.value} to ${A}`)
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
        return convertToGraph(graph,ast.value,set)
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
            const ret2 = convertToGraph(graph,arg,set)
            graph.add(ret2,ret,arg.name)
        })
        return ret
    }
    throw new Error(`unknown AST node type: ${ast.type} `)
}


export const evalBranch = function (branch){
    return resolveValue(branch.root)
}

function resolveValue(node) {
    // console.log(`resolving ${node.type}`)
    if(node.type === 'literal') return Promise.resolve(node.value)
    if(node.type === 'symbolref') {
        return new Promise((res,rej)=>{
            console.log(`looking up symbol ${node.name} from `)
            node.graph.dumpSymbols()
            const expr = node.graph.SYMBOLS[node.name]
            if(!expr) rej(new Error(`symbol not defined: ${node.name}`))
            resolveValue(expr).then(ret=>res(ret))
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
                // console.log("calling function with node",node.id)
                if(!node.storage) node.storage = {}
                const ctx = {
                    node:node,
                    hasStorageValue: function(name) {
                        return !!(node.storage[name]);
                    },
                    setStorageValue: function(name, value) {
                        // console.log(`setting storage ${name} = ${value}`)
                        node.storage[name] = value
                    },
                    getStorageValue: function(name) {
                        // console.log(`getting storage ${name} = ${node.storage[name]}`)
                        return node.storage[name]
                    },
                    createUIComponent: function(opts) {
                        // console.log("creating UI component", opts)
                        node.ui = opts
                    }
                }
                if (fun) res(fun(ctx, args))
                rej(new Error(`no defined function ${node.name}`))
            })
        })
    }
    throw new Error(`got down here. bad node type is ${node.type}`)
}
