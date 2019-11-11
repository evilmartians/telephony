run.define('state_machine', () => {

class State {
    constructor(context, resolve) {
        this.context = context;
        this.resolve = resolve;
    }

    success(params) {
        this.transition('success', params);
    }

    fail(params) {
        this.transition('fail', params);
    }

    transition(name, params) {
        this.resolve({ event: name, params: params });
    }
}

class StateMachine {
    constructor(context, initialStateClass, transitionMap) {
        this.context = context;
        this.currentStateClass = initialStateClass;
        this.transitionMap = transitionMap;
    }

    start() {
        this.enterCurrent();
    }

    enterCurrent(params) {
        Logger.write(`Enter state: ${this.currentStateClass.name}`);

        if(this.currentStateClass) {
            new Promise((resolve, _reject) =>
                new this.currentStateClass(this.context, resolve).enter(params)
            )
            .then(result => this.transition(result.event, result.params))
            .catch(ex => {
                Logger.write(`Exception on State ${this.currentStateClass.name}: ${ex}`);

                VoxEngine.terminate();
            });
        }
        else {
            Logger.write('No state to enter');
        }
    }

    transition(event, params) {
        Logger.write(`State machine event triggered: '${event}'`);

        let events = this.transitionMap[this.currentStateClass.name];
        this.currentStateClass = events[event];
        this.enterCurrent(params);
    }
}

return { State, StateMachine };
}); // run.define
