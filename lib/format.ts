let SINGLE_QUOTE_RE = /'/g;

export function escape (value: any): string {
	let type = typeof value;

	switch (type) {
		case 'string': return `'${value.replace(SINGLE_QUOTE_RE, "''")}'`;
		case 'boolean': return value ? '1' : '0';
		case 'number': if (Number.isFinite(value)) return value + '';

		case 'undefined':
		case 'object': return value == null ? 'null'
			: `'${JSON.stringify(value).replace(SINGLE_QUOTE_RE, "''")}'`;
	}

	throw new Error(`Unsupported value: ${value}`);
}


export class Query {
	sql: string;

	constructor (strings: string[] | TemplateStringsArray, values: any[]) {
		this.sql = strings.reduce((accu, part, idx) => {
			let value = values[idx - 1];

			if (value instanceof Query) return accu + value.sql + part;
			return accu + escape(value) + part;
		});
	}
}


function _sql (strings: string[] | TemplateStringsArray, ...values: any[]) {
	return new Query(strings, values);
}

export let sql = /*#__PURE__*/ Object.assign(_sql, {
	empty: _sql([''], []),

	raw (text: string) {
		return _sql([text], []);
	},

	join (items: any[], separator = ', ') {
		let seps = Array.from({ length: items.length - 1 }, () => separator);
		return _sql(['', ...seps, ''], items);
	},
});
