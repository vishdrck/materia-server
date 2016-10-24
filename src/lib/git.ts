import App from './app'


import * as nodegit from 'nodegit';


export default class Git {
	repo: nodegit.Repository


	constructor(private app: App) {
	}

	load():Promise<nodegit.Repository> {
		return new Promise((resolve, reject) => {
			console.log('before git open')
			nodegit.Repository.open(this.app.path).then((repo) => {
				this.repo = repo
				console.log('after git open')
				resolve(repo)
			}).catch((err) => {
				console.log('error with open', err)
				reject(err);
			})
		})
	}

	getStatus():Promise<number> {
		return this.repo.getStatus(null)
	}

	stage(path):Promise<number> {
		return this.repo.refreshIndex().then(index => {
			return index.addByPath(path)
		}).catch(e => {
			console.log(e, e.stack)
		})
	}

	unstage(path):Promise<number> {
		return this.repo.refreshIndex().then(index => {
			return index.removeByPath(path)
		}).catch(e => {
			console.log(e, e.stack)
		})
	}

	toggleStaging(status):Promise<any> {
		console.log('before staging', status);
		if (status.inIndex()) {
			console.log('unstage')
			return this.unstage(status.path())
		}
		console.log('stage')
		return this.stage(status.path())
	}
}