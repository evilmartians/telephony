run.define('messenger', ['Config'], Config => {

const MANDRILL_API_URL = 'https://mandrillapp.com/api/1.0//messages/send.json';
const SMS_API_URL      = 'https://api.voximplant.com/platform_api/SendSmsMessage/';

Helpers = {
    /**
     * Converts time to such format:
     * "17:15 EDT"
     */
    formatTime: function(time, tz) {
        // Timezone abbreviations
        const tzAbbrMap = {
            "Moscow Standard Time":  "MSK",
            "Eastern Daylight Time": "EDT",
            "Eastern Standard Time": "EST",
            "Pacific Daylight Time": "PDT",
            "Pacific Standard Time": "PST",
            "Eastern European Summer Time": "EEST",
            "Eastern European Standard Time": "EET",
            "Israel Standard Time": "IST",
            "Israel Daylight Time": "IDT"
        };

        let str = time.toLocaleString(
            'en-US',
            { hour: 'numeric', minute: 'numeric', hour12: false, timeZoneName: 'long', timeZone: tz }
        );

        // Attempt to replace long timezone by its abbreviation
        let longTimeZone = str.replace(/\d\d:\d\d\s/, '');

        let abbr = tzAbbrMap[longTimeZone];

        return abbr ? str.replace(longTimeZone, abbr) : str
    },

    // seconds to HH:mm:ss
    formatSeconds: function(sec) {
        return [(sec / 3600), ((sec % 3600) / 60), ((sec % 3600) % 60)]
            .map(v => v < 10 ? "0" + parseInt(v) : parseInt(v))
            .filter((i, j) => i !== "00" || j > 0)
            .join(":")
    },

    toQueryString: function(params) {
        return encodeURI(
            Object.keys(params).map(key => key + '=' + params[key]).join('&')
        )
    }
}

class SendBase {
    constructor() {
        this.zoneTitle = Config.title;
        this.config = Config.messenger;
        this.smdSender = new SmsSender(this.config.voxImplant);
        this.emailSender = new EmailSender(this.config.mandrill);
    }

    sendAll() {
        return Promise.all([
            this.sendEmail(),
            this.sendSms()
        ]);
    }

    sendEmail() {
        let recipientsData = this.recipients().map(r =>
            ({ email: r.email, name: r.name, type: 'to' })
        )

        return this.emailSender.send({
            from_email: this.config.sender.email,
            from_name: this.config.sender.name,
            subject: this.emailSubject(),
            html: this.emailHtml(),
            text: this.emailText(),
            to: recipientsData
        });
    }

    sendSms() {
        return this.smdSender.send(
            this.recipients().map(r =>
                ({ source: this.config.sender.number, sms_body: this.smsText(), destination: r.number })
            )
        );
    }
}

class SendCallMissed extends SendBase {
    /**
     * @param {Array} managers - Array of managers or single manager
     * @param {Object} call
     */
    constructor(managers, call, recording) {
        super();
        this.managers = [].concat(managers);
        this.displayTimezones = this.config.displayTimezones;
        this.callerNumber = `+${call.callerid()}`;
        this.recording = recording;
        this.now = new Date();
    }

    emailSubject() { return `Missed a call to ${this.zoneTitle} from ${this.callerNumber}` }
    emailText() { return this.rawText() }
    smsText() { return this.rawText() }
    recipients() { return this.managers }

    emailHtml() {
        return this.htmlGreetings() + this.htmlFrom() + this.htmlAt() + this.htmlVoicemail()
    }

    htmlGreetings() {
        return `<p>Missed a call to ${this.zoneTitle}!</p>`;
    }

    htmlFrom() {
        return `<p><b>From:</b> <a href="tel:${this.callerNumber}">${this.callerNumber}</a></p>`
    }

    htmlAt() {
        return `<p><b>At:</b> ${this.nowInTimezones().map(t => `<br> ${t}`)}</p>`
    }

    htmlVoicemail() {
        return this.recording ? `<p><b>Voicemail: </b><a href="${this.recording.url}">Listen (${Helpers.formatSeconds(this.recording.duration)})</a></p>` : '';
    }

    // Returns array of formatted strings for each timezone
    nowInTimezones() {
        return this.displayTimezones.map(tz => Helpers.formatTime(this.now, tz))
    }

    rawText() {
        let result = `Missed a call to ${this.zoneTitle} from ${this.callerNumber} at ${this.nowInTimezones().join(', ')}`;

        if(this.recording) {
            result += ` Voicemail available! Listen: ${this.recording.url}`;
        }

        return result;
    }
}

class SendCallMissedToExtension extends SendCallMissed {
    emailSubject() { return `Missed a call to ${this.zoneTitle} to *your extension* from ${this.callerNumber}` }

    htmlGreetings() {
        return `<p>>Missed a call to ${this.zoneTitle} to <b>your extension</b>!`;
    }

    rawText() {
        let result = `Missed a call to ${this.zoneTitle} to your extension from ${this.callerNumber} at ${this.nowInTimezones().join(', ')}`

        if(this.recording) {
            result += ` Voicemail available! Listen: ${this.recording.url}`;
        }

        return result;
    }
}

class EmailSender {
    constructor(credentials) {
        this.credentials = credentials;
    }

    /**
     * Sends email
     * @param {Object} message - Should be Mandrill format https://mandrillapp.com/api/docs/messages.JSON.html
     */
    send(message) {
        let httpOpts = new Net.HttpRequestOptions();
        httpOpts.method = "POST";
        httpOpts.headers = ["User-Agent: Evil Martians Telephony", "Content-Type: application/json;charset=utf-8"];
        httpOpts.postData = JSON.stringify({ key: this.credentials.apiKey, message: message });
        httpOpts.rawOutput = true;

        return Net.httpRequestAsync(
            MANDRILL_API_URL,
            httpOpts
        ).then(resp => {
            Logger.write(`Mandrill API response(${resp.code}): ${bytes2str(resp.data)}`);
        });
    }
}

class SmsSender {
    constructor(crendentials) {
        this.crendentials = crendentials;
    }

    /**
     * Sends sms to multiple receivers
     * @param {Object[]} batch
     * @param {string} batch[].sms_body
     * @param {string} batch[].source - Sender phone number
     * @param {string} batch[].destination - Receiver phone number
     */
    send(batch) {
        return Promise.all(
            batch.map(message => {
                let params = {
                    account_id: this.crendentials.accountId,
                    api_key: this.crendentials.apiKey,
                    source: message.source.replace("+", ""),
                    destination: message.destination.replace("+", ""),
                    sms_body: message.sms_body
                }

                let httpOpts = new Net.HttpRequestOptions();
                httpOpts.method = "POST";
                httpOpts.headers = ["User-Agent: Evil Martians Telephony"];
                httpOpts.postData = Helpers.toQueryString(params);
                httpOpts.rawOutput = true;

                return Net.httpRequestAsync(
                    SMS_API_URL,
                    httpOpts
                ).then(resp => {
                    Logger.write(`VoxImplant API response(${resp.code}): ${bytes2str(resp.data)}`);
                })
            })
        )
    }
}

return { SendCallMissed, SendCallMissedToExtension };
}); // run.define
