const vm = require("vm");
const acorn = require("acorn");
const walk = require("acorn-walk");

class RetrieveGlobals {
	constructor(code, filePath) {
		this.code = code;
		this.filePath = filePath;

		// set defaults
		this.setAcornOptions();
	}

	setAcornOptions(acornOptions) {
		this.acornOptions = Object.assign({
			ecmaVersion: "latest",
		}, acornOptions );
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
		if(typeof context === "object") {
			Object.setPrototypeOf(context, Object.prototype);
		}
	}

	static _getCode(code, isAsync, globalNames) {
		return `(${isAsync ? "async " : ""}function() {
	${code}
	${globalNames ? RetrieveGlobals._getGlobalVariablesReturnString(globalNames) : ""}
})();`;
	}

	_getGlobalContext(data, isAsync) {
		data = data || {};

		let context;
		if(vm.isContext(data)) {
			context = data;
		} else {
			context = vm.createContext(data);
		}

		try {
			let parseCode = RetrieveGlobals._getCode(this.code, isAsync, false);
			let parsed = acorn.parse(parseCode, this.acornOptions);
	
			let globalNames = new Set();
	
			walk.simple(parsed, {
				FunctionDeclaration(node) {
					globalNames.add(node.id.name);
				},
				VariableDeclarator(node) {
					globalNames.add(node.id.name);
				}
			});

			let execCode = RetrieveGlobals._getCode(this.code, isAsync, globalNames);
			return vm.runInContext(execCode, context);
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

			throw new Error(`Had trouble parsing${metadata.length ? ` (${metadata.join(", ")})` : ""}:
${e.message}
${parseCode}`);
		}
	}

	getGlobalContextSync(data) {
		let ret = this._getGlobalContext(data, false);
		this._setContextPrototype(ret);
		return ret;
	}

	async getGlobalContext(data) {
		let ret = await this._getGlobalContext(data, true);
		this._setContextPrototype(ret);
		return ret;
	}
}

module.exports = { RetrieveGlobals };
