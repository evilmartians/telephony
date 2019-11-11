run.define('tone_commands', ['util', 'managers_query'],
  ( { waitFor }
  , { ManagersQuery }
  ) => {

class ToneCommand {
    /**
     * @param {Call} call
     */
    constructor(call, options) {
        options = options || {};
        this.call = call;
        this.onToneListener = this.onTone.bind(this);
        this.call.addEventListener(CallEvents.ToneReceived, this.onToneListener);
        this.call.handleTones(true);
        this.dispatched = new Promise((resolve, reject) => {
            this.dispatchedResolve = resolve;
            this.dispatchedReject = reject;
        });
        this.anyPressed = new Promise((resolve, _reject) => {
            this.anyPressedResolve = resolve;
        });
        this.toneCode = '';

        let enterTimeout = options.enterTimeout || 5000;
        this.anyPressed.then(() =>
            waitFor(this.dispatched, enterTimeout).catch(e => this.reject(e))
        );
    }

    onTone(e) {
        this.toneCode = this.toneCode + e.tone;
        this.anyPressedResolve();
        this.handleCommand(this.toneCode);
    }

    resolve(r) { this.cleanup(); this.dispatchedResolve(r) }
    reject(r) { this.cleanup(); this.dispatchedReject(r) }

    cleanup() {
        this.call.handleTones(false);
        this.call.removeEventListener(CallEvents.ToneReceived, this.onToneListener);
    }
}


class ToneCustomerChooseManager extends ToneCommand {
    handleCommand(ext) {
        if (ext.length == 3) {
            if (ext === '999') return this.resolve({ command: 'play', url: 'https://s3-eu-west-1.amazonaws.com/antoshalee-eu-1/LANDR-youth_106_bpm_mix_11_TRIM.mp3' });

            let manager = ManagersQuery.byExt(ext);

            if (manager) {
                this.resolve({ command: 'dial', manager: manager });
            } else {
                this.reject();
            }
        }
    }
}

class ToneManagerCommand extends ToneCommand {
    handleCommand(toneCode) {
        const Commands = {
            redirect: /^(#)(\d{3})$/,
            conference: /^(##)(\d{3})$/
        }

        let match;

        for (let command in Commands) {
            if (match = toneCode.match(Commands[command])) {
                let manager = ManagersQuery.byExt(match[2]);

                if (manager) {
                    this.resolve({ command: command, manager: manager });
                }
                else {
                    this.reject();
                }

                return;
            }
        }
    }
}

return { ToneCustomerChooseManager, ToneManagerCommand };
}); // run.define
