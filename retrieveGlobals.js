import vm from "vm";
import * as acorn from "acorn";
import * as walk from "acorn-walk";
import { ImportTransformer } from "esm-import-transformer";
import { createRequire, Module } from "module";

// TODO option to change `require` home base
const customRequire = createRequire(import.meta.url);

class RetrieveGlobals {
	constructor(code, options) {
		this.originalCode = code;

		// backwards compat
		if(typeof options === "string") {
			options = {
				filePath: options
			};
		}

		this.options = Object.assign({
			filePath: null,
			transformEsmImports: false,
		}, options);

		// set defaults
		let acornOptions = {};
		if(this.options.transformEsmImports) {
			acornOptions.sourceType = "module";
		}
		this.setAcornOptions(acornOptions);
		this.setCreateContextOptions();

		// transform `import ___ from ___`
		// to `const ___ = await import(___)`
		// to emulate *some* import syntax.
		// Doesn’t currently work with aliases (mod as name) or namespaced imports (* as name).
		if(this.options.transformEsmImports) {
			this.code = this.transformer.transformToDynamicImport();
		} else {
			this.code = this.originalCode;
		}
	}

	get transformer() {
		if(!this._transformer) {
			this._transformer =  new ImportTransformer(this.originalCode);
		}
		return this._transformer;
	}

	setAcornOptions(acornOptions) {
		this.acornOptions = Object.assign({
			ecmaVersion: "latest",
		}, acornOptions );
	}

	setCreateContextOptions(contextOptions) {
		this.createContextOptions = Object.assign({
			codeGeneration: {
				strings: false,
				wasm: false,
			}
		}, contextOptions );
	}

	static _getProxiedContext(context = {}, options = {}) {
		return new Proxy(context, {
			get(target, propertyName) {
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}

				if(options.reuseGlobal && Reflect.has(global, propertyName)) {
					return global[propertyName];
				}
				if(options.addRequire && propertyName === "require") {
					return customRequire;
				}
			}
		});
	}

	// We prune function and variable declarations that aren’t globally declared
	// (our acorn walker could be improved to skip non-global declarations, but this method is easier for now)
	static _getGlobalVariablesReturnString(names) {
		let s = [`let globals = {};`];
		for(let name of names) {
			s.push(`if( typeof ${name} !== "undefined") { globals.${name} = ${name}; }`);
		}
		return `${s.join("\n")}; return globals;`
	}

	_setContextPrototype(context) {
		// Context will fail isPlainObject and won’t be merged in the data cascade properly without this prototype set
		// See https://github.com/11ty/eleventy-utils/blob/main/src/IsPlainObject.js
		if(!context || typeof context !== "object" || Array.isArray(context)) {
			return;
		}

		if(!Object.getPrototypeOf(context).isPrototypeOf(Object.create({}))) {
			Object.setPrototypeOf(context, Object.prototype);

			// Go deep
			for(let key in context) {
				this._setContextPrototype(context[key]);
			}
		}
	}

	static _getCode(code, options) {
		let { async: isAsync, globalNames, experimentalModuleApi, data } = Object.assign({
			async: true
		}, options);

		let prefix = "";
		let argKeys = "";
		let argValues = "";

		// Don’t use this when vm.Module is stable (or if the code doesn’t have any imports!)
		if(experimentalModuleApi) {
			prefix = "module.exports = ";

			if(typeof data === "object") {
				let dataKeys = Object.keys(data);
				if(dataKeys) {
					argKeys = `{${dataKeys.join(",")}}`;
					argValues = JSON.stringify(data, function replacer(key, value) {
						if(typeof value === "function") {
							throw new Error(`When using \`experimentalModuleApi\`, context data must be JSON.stringify friendly. The "${key}" property was type \`function\`.`);
						}
						return value;
					});
				}
			}
		}


		let finalCode = `${prefix}(${isAsync ? "async " : ""}function(${argKeys}) {
	${code}
	${globalNames ? RetrieveGlobals._getGlobalVariablesReturnString(globalNames) : ""}
})(${argValues});`;
		return finalCode;
	}

	_getGlobalContext(data, options) {
		let {
			async: isAsync,
			reuseGlobal,
			dynamicImport,
			addRequire,
			experimentalModuleApi,
		} = Object.assign({
			// defaults
			async: true,

			reuseGlobal: false,

			// adds support for `require`
			addRequire: false,

			// allows dynamic import in `vm` (requires --experimental-vm-modules in Node v20.10+)
			// https://github.com/nodejs/node/issues/51154
			// TODO Another workaround possibility: We could use `import` outside of `vm` and inject the dependencies into context `data`
			dynamicImport: false,

			// Use Module._compile instead of vm
			// Workaround for: https://github.com/zachleat/node-retrieve-globals/issues/2
			// Warning: This method requires input `data` to be JSON stringify friendly.
			// Only use this if the code has `import`:
			experimentalModuleApi: this.transformer.hasImports(),
		}, options);

		// these things are already supported by Module._compile
		if(experimentalModuleApi) {
			addRequire = false;
			dynamicImport = false;
		}

		if(reuseGlobal || addRequire) {
			// Re-use the parent `global` https://nodejs.org/api/globals.html
			data = RetrieveGlobals._getProxiedContext(data || {}, {
				reuseGlobal,
				addRequire,
			});
		} else {
			data = data || {};
		}

		let context;
		if(experimentalModuleApi || vm.isContext(data)) {
			context = data;
		} else {
			context = vm.createContext(data, this.createContextOptions);
		}

		let parseCode;
		let globalNames;

		try {
			parseCode = RetrieveGlobals._getCode(this.code, {
				async: isAsync,
			}, this.cache);

			let parsed = acorn.parse(parseCode, this.acornOptions);

			globalNames = new Set();

			walk.simple(parsed, {
				FunctionDeclaration(node) {
					globalNames.add(node.id.name);
				},
				VariableDeclarator(node) {
					// destructuring assignment Array
					if(node.id.type === "ArrayPattern") {
						for(let prop of node.id.elements) {
							if(prop.type === "Identifier") {
								globalNames.add(prop.name);
							}
						}
					} else if(node.id.type === "ObjectPattern") {
						// destructuring assignment Object
						for(let prop of node.id.properties) {
							if(prop.type === "Property") {
								globalNames.add(prop.value.name);
							}
						}
					} else if(node.id.name) {
						globalNames.add(node.id.name);
					}
				}
			});
		} catch(e) {
			// Acorn parsing error on script
			let metadata = [];
			if(this.options.filePath) {
				metadata.push(`file: ${this.options.filePath}`);
			}
			if(e?.loc?.line) {
				metadata.push(`line: ${e.loc.line}`);
			}
			if(e?.loc?.column) {
				metadata.push(`column: ${e.loc.column}`);
			}

			throw new Error(`Had trouble parsing with "acorn"${metadata.length ? ` (${metadata.join(", ")})` : ""}:
Message: ${e.message}

${parseCode}`);
		}

		try {
			let execCode = RetrieveGlobals._getCode(this.code, {
				async: isAsync,
				globalNames,
				experimentalModuleApi,
				data: context,
			});

			let execOptions = {};

			if(dynamicImport) {
				// Warning: this option is part of the experimental modules API
				execOptions.importModuleDynamically = function(specifier) {
					return import(specifier);
				};
			}

			if(experimentalModuleApi) {
				let m = new Module();
				m._compile(execCode, import.meta.url);
				return m.exports;
			}
			return vm.runInContext(execCode, context, execOptions);
		} catch(e) {
			throw new Error(`Had trouble executing script in Node:
Message: ${e.message}

${this.code}`);
		}
	}

	getGlobalContextSync(data, options) {
		let ret = this._getGlobalContext(data, Object.assign({
			async: false,
		}, options));

		this._setContextPrototype(ret);

		return ret;
	}

	async getGlobalContext(data, options) {
		let ret = await this._getGlobalContext(data, Object.assign({
			async: true,
		}, options));

		this._setContextPrototype(ret);

		return ret;
	}
}

export { RetrieveGlobals };
