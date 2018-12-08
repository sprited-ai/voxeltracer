import _ from 'lodash';
export function sum(a, b) {
    return a + b;
}
function component() {
    var element = document.createElement('div');
    element.innerHTML = _.join(['Hello', 'webpack'], ' ');
    return element;
}
document.body.appendChild(component());
