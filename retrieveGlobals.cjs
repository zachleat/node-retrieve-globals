const vm = require("vm");
const acorn = require("acorn");
const walk = require("acorn-walk");

class RetrieveGlobals {
	constructor(code, filePath) {
		this.code = code;
		this.filePath = filePath;

		// set defaults
		this.setAcornOptions();
		this.setCreateContextOptions();
	}

	setAcornOptions(acornOptions) {
		this.acornOptions = Object.assign({
			ecmaVersion: "latest",
			// sourceType: "module", node:vm doesn’t support modules yet
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

	static _getProxiedContext(context = {}) {
		return new Proxy(context, {
			get(target, propertyName) {
				if(Reflect.has(target, propertyName)) {
					return Reflect.get(target, propertyName);
				}

				// Re-use the parent `global` https://nodejs.org/api/globals.html
				return global[propertyName] || undefined;
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
		let { async: isAsync, globalNames } = Object.assign({
			async: true
		}, options);

		return `(${isAsync ? "async " : ""}function() {
	${code}
	${globalNames ? RetrieveGlobals._getGlobalVariablesReturnString(globalNames) : ""}
})();`;
	}

	_getGlobalContext(data, options) {
		let {
			async: isAsync,
			reuseGlobal,
			dynamicImport,
		} = Object.assign({
			// defaults
			async: true,
			reuseGlobal: false,
			dynamicImport: false,
		}, options);

		if(reuseGlobal) {
			data = RetrieveGlobals._getProxiedContext(data || {});
		} else {
			data = data || {};
		}

		let context;
		if(vm.isContext(data)) {
			context = data;
		} else {
			context = vm.createContext(data, this.createContextOptions);
		}

		let parseCode;
		let globalNames;

		try {
			parseCode = RetrieveGlobals._getCode(this.code, { async: isAsync });
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
			if(this.filePath) {
				metadata.push(`file: ${this.filePath}`);
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
			let execCode = RetrieveGlobals._getCode(this.code, { async: isAsync, globalNames });
			let execOptions = {};

			if(dynamicImport) {
				// Warning: this option is part of the experimental modules API
				execOptions.importModuleDynamically = function(specifier) {
					return import(specifier);
				};
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

module.exports = { RetrieveGlobals };
