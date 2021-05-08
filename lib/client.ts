import { EOL } from 'os';
import { spawn } from 'child_process';

import { create_deferred, generate_random } from './util.js';

import type { ChildProcessWithoutNullStreams } from 'child_process';
import type { Deferred } from './util.js';


export class SqliteError extends Error {}

export class Client {
	options: ClientOptions;

	#instance?: ChildProcessWithoutNullStreams;
	#defer_close?: Deferred<number>;

	#eoq = `-- eoq ${generate_random()}${EOL}`;
	#commit = '';

	#current?: Task;
	#queue: Task[] = [];


	constructor (opts: Partial<ClientOptions>) {
		this.options = {
			bin: 'sqlite3',
			path: ':memory:',
			...opts,
		};
	}

	get running () {
		return !!this.#instance;
	}

	open (): Promise<this> {
		if (this.#instance) {
			return Promise.reject(new Error('Connection already open'));
		}

		return new Promise((resolve, reject) => {
			let error: any;

			let args = [this.options.path, '-header', '-json'];
			let instance = spawn(this.options.bin, args);

			instance.on('error', (err) => error = err);
			instance.on('close', this.#handle_close);

			instance.stderr.on('data', this.#handle_stderr);
			instance.stdout.on('data', this.#handle_stdout);

			setImmediate(() => {
				if (error) {
					reject(error)
				} else {
					this.#instance = instance;
					resolve(this);
				}
			});
		});
	}

	close (opts: CloseOptions = {}): Promise<number> {
		if (!this.#instance) {
			return Promise.reject(new Error('Connection already closed'));
		}

		let { force = false } = opts;

		if (!force) {
			if (this.#queue[this.#queue.length - 1]?.statement != '.exit') {
				this.#run('.exit');
			}
		} else {
			this.#instance.stdin.end();
			this.#instance.kill();
			this.#handle_close(0);
			return Promise.resolve(0);
		}

		if (!this.#defer_close) this.#defer_close = create_deferred();
		return this.#defer_close.promise;
	}


	run<T = any[]> (statement: string | QueryLike): Promise<T> {
		if (!this.#instance) {
			return Promise.reject(new Error('Client already closed'));
		}

		if (is_query_like(statement)) {
			return this.run(statement.sql);
		}

		if (statement[0] == '.') {
			return Promise.reject(new Error('Shell commands are not allowed'));
		}

		return this.#run(statement);
	}


	// @ts-ignore
	#run (statement: string) {
		let task: Task = { ...create_deferred(), statement };
		return this.#execute(task);
	}

	// @ts-ignore
	#execute (task: Task) {
		if (!this.#current) {
			let isShell = task.statement[0] == '.';

			this.#current = task;
			this.#instance!.stdin.write(`${task.statement}${!isShell ? ';' : ''}${EOL}`);
			this.#instance!.stdin.write(`.print ${this.#eoq}`);
		} else {
			this.#queue.push(task);
		}

		return task.promise;
	}

	// @ts-ignore
	#next () {
		if (this.#queue.length) {
			let task = this.#queue.shift()!;
			this.#execute(task);
		}
	}


	#handle_stdout = (chunk: Buffer) => {
		let part = chunk.toString();
		this.#commit += part;

		let task = this.#current!;

		// Node.js receives stdout earlier than stderr,
		// there's really nothing else we can do about this other than to yield
		// then check if we're still dealing with the same task
		setImmediate(() => {
			if (this.#current == task && this.#commit.endsWith(this.#eoq)) {
				let data = this.#commit.slice(0, -(this.#eoq.length));

				this.#commit = '';
				this.#current = undefined;
				this.#next();

				task.resolve(data ? JSON.parse(data) : undefined);
			}
		});
	};

	#handle_stderr = (chunk: Buffer) => {
		let task = this.#current!;

		this.#commit = '';
		this.#current = undefined;
		this.#next();


		let err = chunk.toString();
		let msg = err.slice(err.indexOf(': ') + 2);

		task.reject(new SqliteError(msg));
	};

	#handle_close = (code: number) => {
		let queue = this.#queue.splice(0, this.#queue.length);
		let defer_close = this.#defer_close;

		this.#defer_close = undefined;

		if (this.#current) {
			if (this.#current.statement == '.exit') {
				defer_close?.resolve(code);
			} else {
				defer_close?.reject(code);
				queue.unshift(this.#current);
			}
		}

		for (let task of queue) task.reject(new Error('Connection already closed'));
	};
}

function is_query_like (value: any): value is QueryLike {
	return value && value.sql;
}


export interface ClientOptions {
	/** Path to sqlite3 binary */
	bin: string;
	/** Path to database */
	path: string;
}

export interface CloseOptions {
	force?: boolean;
}

export interface Task extends Deferred<any> {
	statement: string;
}

export interface QueryLike {
	sql: string;
}
