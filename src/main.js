run.require(['Config', 'util', 'state_machine', 'managers_query', 'tone_commands', 'messenger'],
  ( Config
  , { CallAsync, waitFor, WaitTimeout }
  , { StateMachine, State }
  , { ManagersQuery, ManagersPool }
  , { ToneCustomerChooseManager, ToneManagerCommand }
  , { SendCallMissed, SendCallMissedToExtension }
  ) => {

require(Modules.Player);
require(Modules.Conference);

const CHOICE_TIMEOUT = 5000;
const TRY_TIMEOUT = 15000;

class Context {
    constructor(incoming, config) {
        this.incoming = incoming;
        this.config = config;
        this.calledAt = new Date();
    }

    msgClipUrl(name) {
        return `${this.config.baseMsgClipUrl}/${name}.mp3`;
    }

    sfxClipUrl(name) {
        return `${this.config.baseSfxClipUrl}/${name}.mp3`;
    }

    defaultMessageReceiver() {
        return { email: this.config.email }
    }

    playProgressTone() {
        this.incoming.call.playProgressTone(this.config.country);
    }
}

class Started extends State {
    enter() {
        this.context.incoming.call.answer();
        this.success();
    }
}

class ChoosingManager extends State {
    enter() {
        this.incoming = this.context.incoming;

        new Promise((resolve, reject) => {
            let toneCommand = new ToneCustomerChooseManager(this.incoming.call, { enterTimeout: CHOICE_TIMEOUT });

            // Play the intro, pause to see if there is any input
            this.incoming.playback
                .perform(this.context.msgClipUrl('begin'))
                .then(() => waitFor(toneCommand.anyPressed, CHOICE_TIMEOUT))
                .catch(reject);

            // Stop the playback if any input detected
            toneCommand
                .anyPressed
                .then(() => this.incoming.playback.stop());

            // Waiting till the user is finished with tone dial
            toneCommand
                .dispatched
                .then(resolve)
                .catch(e => {
                    if(e === WaitTimeout) {
                        reject();
                    } else {
                        this.incoming.playback
                            .perform(this.context.msgClipUrl('incorrect_person'))
                            .then(reject);
                    }
                });
        })
        .then(result => {
            switch (result.command) {
                case 'dial':
                    this.success({ manager: result.manager });
                    break;
                case 'play':
                    this.transition('play', { url: result.url });
                    break;
            }
        })
        .catch(() => this.fail());
    }
}

class ManagerSession extends State {
    enter(params) {
        this.incoming = this.context.incoming;
        this.manager = params.manager;
        this.outgoing = CallAsync.makePSTN(this.manager.number, this.incoming.callerid());
        this.outgoing.connected
            .then(() => this.onConnect())
            .catch(() => this.onFail());

        this.outgoing.disconnected.then(() => this.onDisconnect());

        this.incoming.disconnected.then(() => this.transition('incomingDisconnected'));

        this.context.playProgressTone();
    }

    onConnect() {
        this.incoming.call.answer();
        VoxEngine.sendMediaBetween(this.incoming.call, this.outgoing.call);
        this.listenToneCommand();
    }

    listenToneCommand() {
        new ToneManagerCommand(this.outgoing.call)
            .dispatched
            .then(result => {
                switch(result.command) {
                    case 'redirect':
                        this.outgoing.hangup();
                        this.transition('redirect', { manager: result.manager });
                        break;
                    case 'conference':
                        this.transition('startConference', { existingManagerCall: this.outgoing, addManager: result.manager });
                        break;
                    default:
                        break
                }
            })
            .catch(() => this.listenToneCommand());
    }

    // End the call
    onDisconnect() {
        this.transition('disconnected');
    }

    // Could not reach the manager
    onFail(e) {
        this.transition('fail', { manager: this.manager });
    }
}

class DirectManagerSession extends ManagerSession {
    onConnect() {
        this.outgoing.playback
            .perform(this.context.msgClipUrl("redirect_person"))
            .then(() => super.onConnect());
    }
}

class DirectManagerFailed extends State {
    enter(params) {
        this.manager = params.manager;
        this.incoming = this.context.incoming;

        this.incoming.answerMachine(this.context.msgClipUrl('end_person'))
            .then(recording => this.notify(recording))
            .catch(() => this.notify())
            .then(() => this.transition('finished'));
    }

    notify(recording) {
        return new SendCallMissedToExtension(this.manager, this.incoming.call, recording).sendAll();
    }
}

class DialAnyInit extends State {
    enter() {
        this.context.availablePool = new ManagersPool(ManagersQuery.availableOn(this.context.calledAt));

        if (this.context.availablePool.isEmpty()) {
            this.transition('emptyPool');
        } else {
            this.context.playProgressTone();
            this.success();
        }
    }
}

class DialAnyNext extends State {
    enter() {
        let manager = this.context.availablePool.next();

        if (manager) {
            this.success({ manager: manager });
        }
        else {
            this.transition('poolExhausted');
        }
    }
}

class DialAnyManagerSession extends ManagerSession {
    enter(params) {
        super.enter(params);

        this.outgoing
            .audioStarted
            .then(() => waitFor(this.outgoing.connected, TRY_TIMEOUT))
            .catch(() => this.outgoing.hangup());
    }

    onConnect() {
        this.outgoing.playback
            .perform(this.context.msgClipUrl("redirect"))
            .then(() => super.onConnect());
    }
}

class DialAnyEmptyPool extends State {
    enter() {
        this.incoming = this.context.incoming;

        this.incoming.answerMachine(this.context.msgClipUrl('end'))
            .then(recording => this.notify(recording))
            .catch(() => this.notify())
            .then(() => this.transition('finished'));
    }

    notify(recording) {
        return Promise.all([
            new SendCallMissed(ManagersQuery.first(), this.incoming.call, recording).sendSms(),
            new SendCallMissed(this.context.defaultMessageReceiver(), this.incoming.call, recording).sendEmail()
        ]);
    }
}

class DialAnyPoolExhausted extends State {
    enter() {
        this.incoming = this.context.incoming;

        this.incoming.answerMachine(this.context.msgClipUrl('end'))
            .then(recording => this.notify(recording))
            .catch(() => this.notify())
            .then(() => this.transition('finished'));
    }

    notify(recording) {
        return Promise.all([
            new SendCallMissed(this.context.availablePool.managers[0], this.incoming.call, recording).sendSms(),
            new SendCallMissed(this.context.defaultMessageReceiver(), this.incoming.call, recording).sendEmail()
        ]);
    }
}

class ConferenceSession extends State {
    enter(params) {
        this.voxConference = VoxEngine.createConference();
        this.calls = [];

        this.voxConference.addEventListener(ConferenceEvents.Started, () => {
            this.connect(this.context.incoming);
            this.connect(params.existingManagerCall);
            this.listenToneCommand(params.existingManagerCall);

            this.joinManager(params.addManager);
        });
    }

    joinManager(manager) {
        let call = CallAsync.makePSTN(manager.number, this.context.incoming.number());

        call.connected
            .then(() => Promise.all([
                call.playback.perform(this.context.msgClipUrl("redirect_conference")),
                this.playToEveryone('connected')
            ]))
            .then(() => this.connect(call))
            .then(() => this.listenToneCommand(call))
            .catch(ex => {
                Logger.write(`Failed to connect: ${ex}`);
                this.playToEveryone('error');
            });
    }

    listenToneCommand(call) {
        new ToneManagerCommand(call.call)
            .dispatched
            .then(result => {
                if (result.command === 'conference') {
                    this.joinManager(result.manager);
                    this.listenToneCommand(call);
                }
            })
            .catch(() => this.listenToneCommand(call));
    }

    callFinished(call) {
        let index = this.calls.findIndex(c => c === call);
        if (index < 0) return;
        this.calls.splice(index, 1);

        if (this.calls.length <= 1) {
            VoxEngine.destroyConference(this.voxConference);
            this.transition('finished');
        }
    }

    connect(c) {
        this.calls.push(c);

        VoxEngine.sendMediaBetween(c.call, this.voxConference);

        c.disconnected.then(() => {
            this.playToEveryone('disconnected');
            this.callFinished(c)
        });
    }

    playToEveryone(clipName) {
        VoxEngine
            .createURLPlayer(this.context.sfxClipUrl(clipName))
            .sendMediaTo(this.voxConference);
    }
}

class Play extends State {
    enter(params) {
        this.context.incoming.playback
            .perform(params.url)
            .then(() => this.transition('finished'));
    }
}

class Terminate extends State {
    enter() {
        VoxEngine.terminate();
    }
}

const TRANSITION_MAP = {
    'Started': {
        'success': ChoosingManager
    },
    'ChoosingManager': {
        'success': DirectManagerSession,
        'play': Play,
        'fail': DialAnyInit
    },
    'DialAnyInit': {
        'success': DialAnyNext,
        'emptyPool': DialAnyEmptyPool
    },
    'DialAnyNext': {
        'success': DialAnyManagerSession,
        'poolExhausted': DialAnyPoolExhausted
    },
    'DialAnyEmptyPool': {
        'finished': Terminate
    },
    'DialAnyPoolExhausted': {
        'finished': Terminate
    },
    'DirectManagerSession': {
        'fail': DirectManagerFailed,
        'redirect': DirectManagerSession,
        'startConference': ConferenceSession,
        'disconnected': Terminate,
        'incomingDisconnected': Terminate
    },
    'DirectManagerFailed': {
        'finished': Terminate
    },
    'DialAnyManagerSession': {
        'fail': DialAnyNext,
        'redirect': DirectManagerSession,
        'startConference': ConferenceSession,
        'disconnected': Terminate,
        'incomingDisconnected': Terminate
    },
    'ConferenceSession': {
        'finished': Terminate
    },
    'Play': {
        'finished': Terminate
    }
}

VoxEngine.addEventListener(AppEvents.CallAlerting, e => {
    let context = new Context(
        new CallAsync(e.call),
        Config
    );

    this.stateMachine = new StateMachine(context, Started, TRANSITION_MAP);
    this.stateMachine.start();
});

}); // run.require
