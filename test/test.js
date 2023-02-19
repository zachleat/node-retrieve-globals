import test from "ava";
import { ModuleScript } from "../moduleScript.js";

test("var", t => {
	let vm = new ModuleScript("var a = 1;");
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
	
	let vm = new ModuleScript("var a = 1;");
	t.true(isPlainObject(vm.getGlobalContextSync()));
});


test("var with data", t => {
	let vm = new ModuleScript("var a = b;");
	t.deepEqual(vm.getGlobalContextSync({ b: 2 }), { a: 2 });
});

test("let with data", t => {
	let vm = new ModuleScript("let a = b;");
	t.deepEqual(vm.getGlobalContextSync({ b: 2 }), { a: 2 });
});

test("const with data", t => {
	let vm = new ModuleScript("const a = b;");
	t.deepEqual(vm.getGlobalContextSync({ b: 2 }), { a: 2 });
});

test("function", t => {
	let vm = new ModuleScript("function testFunction() {}");
	let ret = vm.getGlobalContextSync();
	t.true(typeof ret.testFunction === "function");
});

test("async let", async t => {
	let vm = new ModuleScript(`let b = await Promise.resolve(1);`);
	let ret = await vm.getGlobalContext();
	t.deepEqual(ret, { b: 1 });
});