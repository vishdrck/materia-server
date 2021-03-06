import { join, dirname } from 'path';
import { IAddonTag, IAddonInfo } from '@materia/interfaces';

import { App } from '../app';
import { MateriaAddon } from './helpers';

export class Addon {
	package: string;

	path: string;
	config: any;

	obj: MateriaAddon;

	name: string;
	description: string;
	logo: string;
	author: string;
	version: string;
	tags: IAddonTag[];

	color: string;

	installed: boolean;
	installing: boolean;
	published: any;

	setupConfig: any[];

	packageJsonFile: any;
	enabled = true;

	constructor(private app: App, pkg) {
		this.package = pkg;
	}

	loadFromApp() {
		let AddonClass, addonPackage;
		return this.app.addons.setupModule(require => {
			try {
				this.path = dirname(
					require.resolve(join(this.package, 'package.json'))
				);
				// tslint:disable-next-line:no-unused-expression
				new App(this.path, {});
			} catch (e) {
				this.enabled = false;
				this.app.logger.error(new Error(`Impossible to initialize addon ${this.package}`));
				this.app.logger.error(e);
				return Promise.resolve(e);
			}
			let mod;
			try {
				addonPackage = require(join(
					this.package,
					'package.json'
				));
				const pkg = this.package;
				mod = require(join(pkg, 'server'));
			} catch (e) {
				this.enabled = false;
				this.app.logger.error(new Error(`Impossible to require addon ${this.package}`));
				this.app.logger.error(e);
				return Promise.resolve(e);
			}
			try {
				if (mod.default) {
					AddonClass = mod.default;
				} else {
					AddonClass = mod[addonPackage.materia.addon];
				}
				this.obj = new AddonClass(
					this.app,
					this.app.addons.addonsConfig && this.app.addons.addonsConfig[this.package] || {},
					this.app.server.expressApp
				);
			} catch (e) {
				this.enabled = false;
				this.app.logger.error(new Error(`Impossible to instantiate addon ${this.package}`));
				this.app.logger.error(e);
				return Promise.resolve(e);
			}
			this.packageJsonFile = addonPackage;
			this.package = addonPackage.name;
			this.name = AddonClass.displayName || addonPackage.name;
			this.description = addonPackage.description;
			this.logo = AddonClass.logo;
			this.author =
				(addonPackage.materia && addonPackage.materia.author) ||
				addonPackage.author;
			this.version = addonPackage.version;
			this.color =
				addonPackage.materia &&
				addonPackage.materia.icon &&
				addonPackage.materia.icon.color;
			this.tags =
				(addonPackage.keywords &&
					addonPackage.keywords.map(keyword => {
						return { id: keyword };
					})) ||
				[];

			this.setupConfig = AddonClass.installSettings;
			this.config = this.app.addons.addonsConfig && this.app.addons.addonsConfig[this.package] || {};

			this.installed = true;
			this.installing = false;
			return Promise.resolve();
		});
	}

	loadFromData(data) {
		this.name = data.name;
		this.description = data.description;
		this.logo = data.logo;
		this.author = data.author;
		this.version = data.version;
		this.tags = data.tags;
		this.color = data.color;
	}

	getBundlePath() {
		return join(this.app.path, 'node_modules', this.package, this.packageJsonFile.main);
	}

	start() {
		if (typeof this.obj.start == 'function') {
			const startResult = this.obj.start();
			if (this._isPromise(startResult)) {
				return startResult;
			} else {
				return Promise.resolve(startResult);
			}
		}
		return Promise.resolve();
	}

	beforeLoadEntities(): Promise<any> {
		return this._hook('beforeLoadEntities');
	}

	afterLoadEntities(): Promise<any> {
		return this._hook('afterLoadEntities');
	}

	beforeLoadQueries(): Promise<any> {
		return this._hook('beforeLoadQueries');
	}

	afterLoadQueries(): Promise<any> {
		return this._hook('afterLoadQueries');
	}

	beforeLoadAPI(): Promise<any> {
		return this._hook('beforeLoadAPI');
	}

	afterLoadAPI(): Promise<any> {
		return this._hook('afterLoadAPI');
	}

	setup(config: any): Promise<void> {
		this.config = config;
		return this.app.addons.setConfig(this.package, config);
	}

	getSetupConfig(): any[] {
		return this.setupConfig || [];
	}

	disable() {
		this.enabled = false;
		return this.setup(Object.assign({}, this.config || {}, {
			disabled: true
		}));
	}

	enable() {
		if (this.config && this.config.disabled) {
			delete this.config.disabled;
		}
		this.enabled = true;
		return this.setup(this.config);
	}

	toJson(): IAddonInfo {
		return {
			package: this.package,
			name: this.name,
			description: this.description,
			logo: this.logo,
			version: this.version,
			tags: this.tags,
			author: this.author,
			color: this.color,
			enabled: this.enabled
		};
	}

	private _hook(name: string): Promise<any> {
		if (typeof this.obj[name] == 'function') {
			const result = this.obj[name]();
			if (this._isPromise(result)) {
				return result;
			}
			return Promise.resolve(result);
		}
		return Promise.resolve();
	}

	private _isPromise(obj: any): boolean {
		return (
			obj &&
			obj.then &&
			obj.catch &&
			typeof obj.then === 'function' &&
			typeof obj.catch === 'function'
		);
	}
}
