import test from "ava";
import { RetrieveGlobals } from "../retrieveGlobals.js";

test("var", t => {
	let vm = new RetrieveGlobals("var a = 1;");
	t.deepEqual(vm.getGlobalContextSync(), { a: 1 });
});

test("isPlainObject", t => {
	// from eleventy-utils
	function isPlainObject(value) {
		if (value === null || typeof value !== "object") {
			return false;
		}
		let proto = Object.getPrototypeOf(value);
		return !proto || proto === Object.prototype;
	};

	let vm = new RetrieveGlobals("var a = 1;");
	t.true(isPlainObject(vm.getGlobalContextSync()));
});

test("isPlainObject deep", t => {
	// from eleventy-utils
	function isPlainObject(value) {
		if (value === null || typeof value !== "object") {
			return false;
		}
		let proto = Object.getPrototypeOf(value);
		return !proto || proto === Object.prototype;
	};

	let vm = new RetrieveGlobals("var a = { b: 1, c: { d: {} } };");
	let obj = vm.getGlobalContextSync();
	t.true(isPlainObject(obj.a.c));
	t.true(isPlainObject(obj.a.c.d));
});

test("isPlainObject deep circular", t => {
	// from eleventy-utils
	function isPlainObject(value) {
		if (value === null || typeof value !== "object") {
			return false;
		}
		let proto = Object.getPrototypeOf(value);
		return !proto || proto === Object.prototype;
	};

	let vm = new RetrieveGlobals(`
var a = { a: 1 };
var b = { b: a };
a.b = b;
`);
	let obj = vm.getGlobalContextSync();
	t.true(isPlainObject(obj.a.b));
	t.true(isPlainObject(obj.b.b));
});


test("var with data", t => {
	let vm = new RetrieveGlobals("var a = b;");
	t.deepEqual(vm.getGlobalContextSync({ b: 2 }), { a: 2 });
});

test("let with data", t => {
	let vm = new RetrieveGlobals("let a = b;");
	t.deepEqual(vm.getGlobalContextSync({ b: 2 }), { a: 2 });
});

test("const with data", t => {
	let vm = new RetrieveGlobals("const a = b;");
	t.deepEqual(vm.getGlobalContextSync({ b: 2 }), { a: 2 });
});

test("function", t => {
	let vm = new RetrieveGlobals("function testFunction() {}");
	let ret = vm.getGlobalContextSync();
	t.true(typeof ret.testFunction === "function");
});

test("async let", async t => {
	let vm = new RetrieveGlobals(`let b = await Promise.resolve(1);`);
	let ret = await vm.getGlobalContext();
	t.deepEqual(ret, { b: 1 });
});

test("destructured assignment via object", async t => {
	let vm = new RetrieveGlobals(`const { a } = { a: 1 };`);
	let ret = await vm.getGlobalContext();
	t.is(typeof ret.a, "number");
	t.is(ret.a, 1);
});

test("destructured assignment via Array", async t => {
	let vm = new RetrieveGlobals(`const [a, b] = [1, 2];`);
	let ret = await vm.getGlobalContext();
	t.is(typeof ret.a, "number");
	t.is(typeof ret.b, "number");
	t.is(ret.a, 1);
	t.is(ret.b, 2);
});


test("dynamic import", async t => {
	let vm = new RetrieveGlobals(`const { noop } = await import("@zachleat/noop");`);
	let ret = await vm.getGlobalContext(undefined, {
		dynamicImport: true
	});
	t.is(typeof ret.noop, "function");
});

test("global: same console.log", async t => {
	let vm = new RetrieveGlobals(`const b = console.log`);
	let ret = await vm.getGlobalContext(undefined, {
		reuseGlobal: false
	});
	t.not(ret.b, console.log);

	let ret2 = await vm.getGlobalContext(undefined, {
		reuseGlobal: true
	});
	t.is(ret2.b, console.log);
});

test("global: Same URL", async t => {
	let vm = new RetrieveGlobals(`const b = URL`);
	let ret = await vm.getGlobalContext(undefined, {
		reuseGlobal: true
	});
	t.is(ret.b, URL);
});

test("return array", t => {
	let vm = new RetrieveGlobals("let b = [1,2,3];");
	let globals = vm.getGlobalContextSync();
	t.true(Array.isArray(globals.b));
	t.deepEqual(globals.b, [1,2,3]);
});

test("ESM import", async t => {
	let vm = new RetrieveGlobals(`import { noop } from "@zachleat/noop";
const b = 1;`, null, {
		transformEsmImports: true,
	});
	let ret = await vm.getGlobalContext(undefined, {
		dynamicImport: true
	});
	t.is(typeof ret.noop, "function");
	t.is(ret.b, 1);
});