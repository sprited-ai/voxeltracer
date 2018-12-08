import * as _ from 'lodash';

export function sum(a: number, b: number) {
    return a + b;
}

function component() {
    let element = document.createElement('div');

    // Lodash, currently included via a script, is required for this line to work
    element.innerHTML = _.join(['Hello', 'webpack'], ' ');

    return element;
}

// document.body.appendChild(component());

import * as React from 'react';
import * as ReactDOM from 'react-dom';

ReactDOM.render(
  <div>Use TypeScript with React</div>,
  document.getElementById('root')
);


