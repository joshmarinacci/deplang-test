import React, {Component} from "react"

export default class ValueView extends Component {
    render() {
        if(this.props.value) {
            return <div className="panel">{this.renderValue(this.props.value)}</div>
        } else {
            return <div className="panel">no value </div>
        }
    }

    renderValue(value) {
        if(value.type === 'literal') {
            return <span>{value.value}</span>
        }
    }
}