// Filename must be prefixed with '_' to enforce it to be loaded first

class Container {
    constructor() {
        this.defResolvers = {};
        this.defPromises = {};
    }

    require(depList, body) {
        if (body === undefined) {
            body = depList;
            depList = [];
        }
        let depPromises = depList.map(d => this.defPromise(d));
        return Promise.all(depPromises)
            .then((deps) => body(...deps))
            .catch(name => {
                throw `Unable to require ${name}`;
            });
    }

    define(name, depList, body) {
        if (body === undefined) {
            body = depList;
            depList = [];
        }
        let resolver = this.defResolver(name);
        return this.require(depList, (...deps) => resolver(body(...deps)));
    }

    defPromise(name) {
        if (!this.defPromises[name]) {
            this.defPromises[name] = new Promise((resolve, reject) => {
                let timer = setTimeout(() => reject(name), 1000);
                this.defResolvers[name] = obj => { clearTimeout(timer); return resolve(obj) };
            });
        }

        return this.defPromises[name];
    }

    defResolver(name) {
        this.defPromise(name);
        return this.defResolvers[name];
    }
}

var run = new Container;