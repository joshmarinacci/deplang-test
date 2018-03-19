import React, { Component } from 'react';
import ohm  from 'ohm-js'
import './App.css';
import InputPanel from './InputPanel'

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
    }
}

function makeToGraphSemantics(graph, grammar) {
    return grammar.createSemantics().addOperation('toGraph', {
        Number: (a) => graph.makeLiteral(a.sourceString,parseInt(a.sourceString,10)),
        String: (_q1,str,_q2)  => graph.makeLiteral(str.sourceString,str.sourceString),
        identifier: function(str, rest) { return graph.makeSymbolReference(this.sourceString) },
        Arguments: (a) => a.asIteration().toGraph(),
        Parameter: (id, _, expr) => ({ name:id.sourceString, value:expr.toGraph() }),
        FunCall: function(id, op, params, cp) {
            const id_s = id.toGraph()
            const expr = graph.makeExpression(id_s.name)
            const args = params.toGraph()
            args.forEach(arg => graph.add(arg.value,expr,arg.name))
            return expr
        },
        Statement: function(first, _, rest) {
            const ret = {
                type:'statement',
                first:first.toGraph(),
                rest:rest.toGraph(),
            }
            // const rest_n = rest.toGraph()
            ret.rest.reduce((first,next)=>{
                if(next.type === 'symbolref') graph.SYMBOLS[next.name] = first
                if(next.type === 'expression') graph.add(first,next,'input')
                return next
            },ret.first)
            return ret
            // if(rest_n.length > 0) {
            //     console.log("returning", rest_n[rest_n.length-1])
            //     return rest_n[rest_n.length-1]
            // }
        },
        Block: function(statements) {
            return {
                type:'block',
                statements: statements.toGraph()
            }
        }
    })
}

function resolveValue(node) {
    if(node.type === 'literal') return Promise.resolve(node.value)
    if(node.type === 'symbolref') {
        return new Promise((res,rej)=>{
            const expr = node.graph.SYMBOLS[node.name]
            if(!expr) rej(new Error("symbol not defined: " + node.name, node))
            resolveValue(expr).then((ret)=>{
                res(ret)
            })
        })
    }
    if(node.type === 'block') {
        // console.log("it's a block. do the last statement.")
        const last = node.statements[node.statements.length-1]
        // console.log("last is", last.type)
        return resolveValue(last)
    }
    if(node.type === 'statement') {
        // console.log("its a statement",node)
        if(node.rest.length > 0) {
            const last = node.rest[node.rest.length-1]
            // console.log("last is",last)
            return resolveValue(last)
        }

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
                rej(new Error("no defined function", node.name))
            })
        })
    }
    console.log("ERROR: unrecognized type",node.type)
}


class App extends Component {
    render() {
        return <div id="main">
            <InputPanel key="1"/>
        </div>
    }
}

export default App;
