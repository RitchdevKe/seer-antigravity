const React = require('react');
const { renderToString } = require('react-dom/server');
const App = require('./dist/server.cjs').default;
try {
  renderToString(React.createElement(App));
  console.log('RENDER SUCCESS');
} catch (e) {
  console.error('RENDER ERROR:', e);
}
