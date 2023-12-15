# node-retrieve-globals

Execute a string of JavaScript using Node.js and return the global variable values and functions.

* Supported on Node.js 16 and newer.
* Uses `var`, `let`, `const`, `function`, Array and Object [destructuring assignment](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment).
* Async-only as of v5.0.
* Can return any valid JS data type (including functions).
* Can provide an external data object as context to the local execution scope
* Uses [Node’s `vm` module to execute JavaScript](https://nodejs.org/api/vm.html#vmruninthiscontextcode-options)
	* ⚠️ The `node:vm` module is not a security mechanism. Do not use it to run untrusted code.
	* `codeGeneration` (e.g. `eval`) is disabled by default; use `setCreateContextOptions({codeGeneration: { strings: true, wasm: true } })` to re-enable.
	* Works with or without `--experimental-vm-modules` flag in Node.js to enable `vm.Module` support.
	* Future-friendly feature tests for when `vm.Module` is stable and `--experimental-vm-modules` is no longer necessary.
* In use on:
	* [JavaScript in Eleventy Front Matter](https://www.11ty.dev/docs/data-frontmatter-customize/#example-use-javascript-in-your-front-matter) (and [Demo](https://github.com/11ty/demo-eleventy-js-front-matter))
	* [WebC’s `<script webc:setup>`](https://www.11ty.dev/docs/languages/webc/#using-javascript-to-setup-your-component-webcsetup)

## Installation

Available on [npm](https://www.npmjs.com/package/node-retrieve-globals)

```
npm install node-retrieve-globals
```

## Usage

Works from Node.js with ESM and CommonJS:

```js
import { RetrieveGlobals } from "node-retrieve-globals";
// const { RetrieveGlobals } = require("node-retrieve-globals");
```

And then:

```js
let code = `var a = 1;
const b = "hello";

function hello() {}`;

let vm = new RetrieveGlobals(code);

await vm.getGlobalContext();
```

Returns:

```js
{ a: 1, b: "hello", hello: function hello() {} }
```

### Pass in your own Data and reference it in the JavaScript code

```js
let code = `let ref = myData;`;

let vm = new RetrieveGlobals(code);

await vm.getGlobalContext({ myData: "hello" });
```

Returns:

```js
{ ref: "hello" }
```

### Advanced options

```js
// Defaults shown
let options = {
	reuseGlobal: false, // re-use Node.js `global`, important if you want `console.log` to log to your console as expected.
	dynamicImport: false, // allows `import()`
	addRequire: false, // allows `require()`
	experimentalModuleApi: false, // uses Module#_compile instead of `vm` (you probably don’t want this and it is never allowed when vm.Module is supported)
};

await vm.getGlobalContext({}, options);

