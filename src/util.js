run.define('util', () => {

/**
 * @param {Object} obj This could be `Call` or `VoxEngine`
 * @param {Object} ev This could be some `CallEvents` or `AppEvents`
 * @param {Function} callback Listening function
 */
function addOneOffEventListener(obj, ev, callback) {
    function listener(e) {
        obj.removeEventListener(ev, listener);
        callback(e);
    }
    obj.addEventListener(ev, listener);
}

const WaitTimeout = new Object;

function wait(interval) {
    return new Promise((resolve, _reject) => setTimeout(resolve, interval, WaitTimeout));
}

function waitFor(promise, interval) {
    return new Promise((resolve, reject) => {
        promise.then(resolve).catch(reject);
        wait(interval).then(reject)
    });
}

class CallAsync {
    static makePSTN(number, callerid) {
        return new this(VoxEngine.callPSTN(number, callerid));
    }

    constructor(call) {
        this.call = call;
        this.connected = new Promise((resolve, reject) => {
            call.addEventListener(CallEvents.Connected, resolve);
            call.addEventListener(CallEvents.Failed, reject);
        });
        this.audioStarted = new Promise((resolve, _reject) => {
            call.addEventListener(CallEvents.AudioStarted, resolve);
        });
        this.disconnected = new Promise((resolve, _reject) => {
            call.addEventListener(CallEvents.Disconnected, resolve);
        });
        this.playback = new Playback(call);
    }

    callerid() { return this.call.callerid() }
    
    number() { return this.call.number() }

    hangup() { this.call.hangup() }

    /**
     * @param {VoxEngine.RecorderParameters} parameters
     * @returns {Promise}
     */
    record(parameters) {
        return new Promise((resolve, _reject) => {
            this.call.record(parameters);
            this.call.addEventListener(CallEvents.RecordStopped, resolve);
        });
    }

    /**
     * @param {Call} call
     * @param {number} frequency - Hz
     * @param {number} duration - seconds
     * @returns {Promise}
     */
    playTone(frequency, duration) {
        let toneScript = `${frequency}@-16;${duration}(*/.0/1))`;

        VoxEngine
            .createToneScriptPlayer(toneScript)
            .sendMediaTo(this.call);

        return wait(duration * 1000);
    }

    answerMachine(url) {
        return Promise.race([
            this.playback
                .perform(url)
                .then(() => this.playTone(1000, 1)),
            this.disconnected.then(() => Promise.reject().catch())
        ])
        .then(() => this.record());
    }
}

class Playback {
    /**
     * @param {Call} call
     */
    constructor(call) {
        this.call = call;
        this.currentIndex = 0;
    }

    /**
     * @param {String} url
     * @returns {Promise}
     */
    perform(url) {
        let index = ++this.currentIndex;
        return new Promise((resolve, _reject) => {
            addOneOffEventListener(this.call, CallEvents.PlaybackFinished, () => {
                if (index == this.currentIndex) resolve();
            });
            this.call.startPlayback(url);
        });
    }

    stop() { this.call.stopPlayback() }
}

return { wait, waitFor, WaitTimeout, CallAsync };
}); // run.define