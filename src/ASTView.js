import React, { Component } from 'react';
export default class ASTView extends Component {
    render() {
        if(this.props.ast) {
            return <div className="panel">{this.renderAST(this.props.ast)}</div>
        } else {
            return <div className="panel">no AST yet</div>
        }
    }

    renderAST(ast) {
        if(ast.type === 'block') {
            return <ul><div><b>block</b></div>
                {ast.statements.map((a,i) => <li key={i}>{this.renderAST(a)}</li>)}</ul>
        }
        if(ast.type === 'statement') {
            return <ul><div><b>statement</b></div>
                {ast.parts.map((a,i) => <li key={i}>{this.renderAST(a)}</li>)}</ul>
        }

        if(ast.type === 'literal') {
            return <div><b>Literal</b>: <i>{ast.value}</i></div>
        }
        if(ast.type === 'identifier') {
            return <div><b>identifier</b>: <i>{ast.value}</i></div>
        }
        if(ast.type === 'funcall') {
            return <ul>
                <div><b>function call</b> ID: <i>{this.renderAST(ast.id)}</i></div>
                {ast.params.map((a,i)=> <li key={i}>{this.renderAST(a)}</li>)}</ul>
        }
        if(ast.type === 'parameter') {
            return <div><b>param</b> <i>{ast.name}</i> {this.renderAST(ast.value)}</div>
        }
        return <div>unknown ast node</div>
    }
}