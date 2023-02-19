# node-retrieve-globals

Execute a string of JavaScript using Node.js and return the global variable values and functions.

* Sync and async methods for synchronous or asynchronous JavaScript code respectively.
* Can return any JavaScript data types
* Can provide external variable values as context to the local scope

## Usage

```js
let code = `var a = 1;
const b = "hello";

function hello() {}`;

let vm = new ModuleScript(code);

vm.getGlobalContextSync();
// or await vm.getGlobalContext();
```

Returns:

```js
{ a: 1, b: "hello", hello: function hello() {} }
```

### Pass in your own Data and reference it in the JavaScript code

```js
let code = `let ref = myData;`;

let vm = new ModuleScript(code);

vm.getGlobalContextSync({ myData: "hello" });
// or await vm.getGlobalContext({ myData: "hello" });
```

Returns:

```js
{ ref: "hello" }
```
