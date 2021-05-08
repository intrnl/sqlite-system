# sqlite-system

Painless Node.js wrapper for SQLite, works by spawning a sqlite3 shell process
and communicating to it, removing the need for a native addon.

Requires at least SQLite v3.33.0, only tested with v3.35.4+ on Linux.

- `.print` command (v3.7.15)
- JSON output mode (v3.33.0)


## Usage

```js
import { Client } from '@intrnl/sqlite-system';

// File path relative to current working directory,
// default is in-memory database.
let db = new Client({ filename: './data.db' });

await db.open();

let result = await db.run('SELECT * FROM users');
// [
//   { id: 1, name: 'John' },
//   { id: 2, name: 'Bill' }
// ]

await db.close();
```

### SQL tagged templates and escaping

Due to the use of sqlite3, prepared statements are unavailable, but the library
provides built-in escaping utilities.

```js
import { sql } from '@intrnl/sqlite-system';

// Escape values
sql`INSERT INTO users (name) VALUES (${'foobar'})`;

// Interpolate raw SQL
let table = sql.raw('scores');
sql`INSERT INTO ${table} (name, score) VALUES (${'foobar'}, ${123})`;

// Join queries
sql`SELECT * FROM books ${hasId ? sql`WHERE ids IN (${sql.join(ids)})` : sql.empty}`;
```

## License

**sqlite-system** © [intrnl][license-author]  
Licensed under MIT


[license-author]: https://github.com/intrnl
