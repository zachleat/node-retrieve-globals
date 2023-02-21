# node-retrieve-globals

Execute a string of JavaScript using Node.js and return the global variable values and functions.

* Async-friendly but synchronous methods are available.
* Can return any valid JS data type (including functions).
* Can provide an external data object as context to the local execution scope
* Uses [Node’s `vm` module to execute JavaScript](https://nodejs.org/api/vm.html#vmruninthiscontextcode-options)
	* ⚠️ The `node:vm` module is not a security mechanism. Do not use it to run untrusted code.
	* `codeGeneration` (e.g. `eval`) is disabled by default; use `setCreateContextOptions({codeGeneration: { strings: true, wasm: true } })` to re-enable.

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

// or sync:
// vm.getGlobalContextSync();
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

// or sync:
// vm.getGlobalContextSync({ myData: "hello" });
```

Returns:

```js
{ ref: "hello" }
```
