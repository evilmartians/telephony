# Evil Martians Telephony

A cloud-based Martian swiss army knife for voice calls, VoIP, conferencing, and voicemail. Powered by [VoxImplant](https://voximplant.io?utm_source=evilmartians-telephony).

<a href="https://evilmartians.com/?utm_source=telephony">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
       alt="Sponsored by Evil Martians" width="236" height="54">
</a>

## Overview

The code is for an open source version of Evil Martians' very own telephony platform that runs all [our phone numbers](https://evilmartians.com/talk-to-us).

This is a swiss army knife for everything we do with our phone numbers at Evil Martians. It currently runs on the [VoxImplant](https://voximplant.io) cloud platform, is implemented in JavaScript, and is designed to run via continuous integration and continuous deployment tools.

You can use it to build your simple telephony solutions, with one or multiple office locations, managers scheduled to answer a call, conferencing, and short numbers.

It should be relatively easy to change the system for your specific usage requirements and integrations, or configure and run it as-is.

The application is mostly designed for engineering-friendly companies. It is intended for advanced users who know their way around Git and can alter the address book or schedule by editing JSON and pushing the code or making a pull request. This way, we can avoid monstrous integrations, and every single change is right there in the git repository.

## Cheatsheet

|                                |                                                      |
|--------------------------------|------------------------------------------------------|
| **Address book:**              | `address_book.json`                                  |
| **Schedule:**                  | `ZONE-schedule.json`                                 |
| **Extension numbers:**         | 3 digits, dial immediately after the machine answers |
| **Forward and hang up:**       | `#NUMBER`, for instance, `#001`                      |
| **Add to a conference, stay:** | `##NUMBER`, for instance `##001`                     |

## Usage

### Zones

The application shares code between _zones_. Think of "zone" as an office location or an application. Each zone is defined by its config and schedule. Some companies would only require a single zone.

In our use case, "US", "RU" and "JP" are the zones that we have—assigned to every country we have an office in.

### Address book and schedule

The application requires a shared address book for all zones and one schedule per each zone.

**N.B.:** For end-users, it is advised to use a programming code editor to edit the file. Great if you have a JavaScript/JSON linter turned on. As soon as you commit the file into the repository, the software is designed to use the continuous integration server to build and push the configuration to the production environment. If there are any errors, syntax or otherwise, you will get an email. If everything is fine, changes will be applied in under a couple of minutes.


#### Address book

The address book is shared company-wide and available for all zones. That means that you can dial or forward calls to any user in the address book, no matter the phone number called or the current active zone.

**Most importantly, everyone in the company should be encouraged to add themselves to the address book.** You don't have any obligations when you pick a short number/extension code, so it's completely safe even if you're not a manager. You will get an extension number that works on all phones and all zones, an ability to forward calls to you or be invited to a conference, and a voicemail feature for your extension number.

The address book itself is a JSON file called `address_book.json`.

Example:

```json
[
    {
        "email": "jane.doe@example.com",
        "ext": "001",
        "name": "Jane Doe",
        "number": "+1 206 555 0001"
    }
]
```

All fields are mandatory. `email` is the email address where you will get notifications about missed calls and voicemails. Use your primary corporate email address.

`ext` is your extension number. Three digits, no more, no less.

`name` is your name.

`number` is your phone number in full international form, starting with country code and a `+`. Make sure to update it frequently if you travel.

#### Schedule

A schedule is where the call queue/schedule is defined. When a call goes to a zone number, the system will try each person from the list, top to bottom, with respect to their schedule and timezone.

The schedule is a file called like `ZONE-schedule.json`.

Let's take a look:

```json
[
  {
      "email": "jane.doe@example.com",
      "timeZone": "America/New_York",
      "schedule": {
          "Mon": [9, 18],
          "Tue": [9, 18],
          "Wed": [9, 18],
          "Thu": [9, 18],
          "Fri": [9, 18]
      }
  },
  {
      "email": "john.doe@example.com",
      "timeZone": "America/Los_Angeles",
      "schedule": {
          "All": [7, 20]
      }
  }
]
```

In this example, Jane is the first one to get a call. Her schedule is defined in the New York time zone, from Monday to Friday, from 9 to 18. In case Jane is not available on her phone—or the call was not received at business hours—John is next on the line, working at Los Angeles time zone (PST), from 7 to 20 every day. If John is unavailable as well, the call goes to voicemail.

`email` is a person's email, and it should be the same as the email in the Address book. It is also not possible to add a person to schedule if they are not in an Address book. Again, make sure to use your primary email.

`timeZone` is the time zone for the following schedule. Note that your time zone is not the same thing as the nearest larger city. For a precise list of time zone identifiers, check https://momentjs.com/timezone/. Usually, it's `America/Los_Angeles` for PST and `America/New_York` for EST.

`schedule` is your working hours schedule. You can use the `All` key to define a unified schedule for all days of the week or specify a different schedule for each day of the week using the three-letter short form. All hours are in 24-hour format, to prevent any mixup.

### Calling in

As a caller, I will be greeted with a pre-recorded message telling me to stay on the line or dial an extension number.

#### General number

If I don't know any extension numbers, I will stay on the line, and the software will try each person from the schedule list for the zone. The software will seek only the people who can answer the call right now, according to the schedule. Each person will be tried for 15 seconds, there will be an outgoing call, and I will hear the beeps. If there was no answer, or there was an error of any kind, networking, cellular or otherwise, the software will automatically try the next number.

Once I am connected to a manager, I can have a regular old-fashioned talk. Once the manager or I hang up, the call will end. The manager could also redirect me to a different person or make a conference call, adding another person.

If nobody can answer or if the queue is empty (for instance, if the call is late at night and zero people are working at that time, according to schedule), my call will go straight to voicemail, with a helpful message. I can hang the phone immediately; in this case, managers will receive an SMS and an email message stating my number to get back to me. Alternatively, I can leave a voicemail, and in this case, the email with my info will also have a link to the voicemail.

#### Extension number

If I want to reach a specific person, I can use my tone dial to dial three digits (`001`, for instance).

If the number I dialed is wrong (no such number or I've made a mistake), there will be a helpful message advising me to hang up and try again or stay on the line. If I stay on the line, the call will be treated as a general call to a company number, and hopefully, one of the managers will pick up.

If the number is correct, I will hear the beeps while the software is trying to call a person. If the person picks up, I can have a regular call; the manager on the other side will be able to redirect me to someone or make a conference call as well.

If the number is correct, but the person did not answer, I will get a helpful message asking me to leave a voicemail. I can hang up immediately; in this case, the manager will get an SMS and an email with my number. Alternatively, I can leave a voicemail, and in this case, the email to the manager will include the recording.

### Receiving the call

#### Manager

As a manager, I may be on one of the schedules for a zone. I must update my phone number each time it is changed and fine-tune my scheduling as discussed with other managers from my zone.

Once I get a call from the client to a general company phone number, my phone will display that client's number, so that I can get back to them later. When I pick the phone, a pre-recorded message will state that this is a call to a company. Following the message, I can have a regular call with a caller and hang up later. The call ends when one of us hangs up.

If it is not my turn to receive calls, according to the schedule, the software will never try to call me at all.

If I cannot answer, I can decline the call, and the software will try another manager automatically or go straight to voicemail.

If no one were able to answer, because of scheduling or unavailability, there would be an SMS stating that there was a missing call and an email; both will contain that person's number. The email will include the caller's phone number and call time in various timezones specific to each zone. If the person did leave a voicemail, the email would contain a link to the recording. Keep in mind that the file will be available for several months only, so make sure to download it if it is useful.

#### Extension number

As any person in the address book, I can get direct calls by my extension number.

I will get a call, and my phone will display the client's number. If I'm available, I can pick the phone. It will start with the software instructing me that this is a call to my extension number through the system. I will have a regular call; it will end as soon as one of us leaves the call.

If I can't answer or if there is any mistake, I will receive an SMS saying I have missed the call from that specific number as well as an email message with the number. The email will include the caller's phone number and call time in various timezones specific to each zone. If the person did leave a voicemail, the email would contain a link to the recording. Keep in mind that the file will be available for several months only, so make sure to download it if it is useful.

### Conferencing

As a manager, at any given moment during a call, I can add another person from the address book to the call.

#### Redirect

I can redirect the client to a specific person—for instance, if they've talked before or if that person is in the loop.

In this case, I do a tone dial oh my phone: `#NUMBER`, where NUMBER is the desired person's extension code, for instance, `#001`. I will be disconnected momentarily, and the client will hear beeps while the software is trying to call a person.

The person I'm redirecting to will get a regular call as if they are being called by their extension number.

If there is a mistake connecting (no answer, for instance), the software will treat this call as a call to a personal extension number: there will be an option to leave a voicemail and the person specified will receive SMS and email messages.

#### Conference call

I can make a conference call with the desired person. Unlike the redirect, in this case, I will have an option to continue the call and stay on the line. It is best if I want to introduce people one to another, give some context and feedback.

To do that, I dial `##NUMBER`, for instance, `##001`. There will be an audio indication when I dial the person, and there will be an audio indication if the call failed—or when a person joins a conference call.

The person receiving a call will get a pre-recorded message that they are being summoned to a conference call.

Technically, I can add as many people as I want—from the address book.

The call will end as soon as there are no people from our side present.

## Setup

Each zone is defined by a configuration file (`ZONE-config.json.erb`), a schedule (`ZONE-schedule.json`), and a sound samples directory that is hosted on the web (see `examples/` for examples). The address book is shared company-wide.

### Local prerequisites

You'll need Ruby to run the validation scripts.

If you're only planning to compile and validate from your continuous integration server, you can safely skip this step.

Otherwise, [install the latest stable Ruby version](https://www.ruby-lang.org/en/documentation/installation/), followed by

```
gem install bundler
````

and then run

```
bundle install
```

in the project directory.

### Services prerequisites

You will need a VoxImplant application, at least one phone number connected to it (you should be able to receive testing phone numbers for free), and a Mandrill account to send email notifications.

First, [create a VoxImplant application](https://voximplant.com/docs/references/articles/quickstart/apps-scenarios-rules-and-users).

Get the [API keys](https://manage.voximplant.com/settings/api_keys) to use with your application. Either use them as environment variables (`VOX_ACCOUNT_ID`, `VOX_API_KEY`, the sample zone configuration file encourages that approach), or later replace ERB template instructions with just copy-pasting the values.

Sign up to Mandrill, if you don't have an account yet, and get an API key. Again, use it as an environment variable (`MANDRILL_API_KEY`) or later copy and paste in the zone configuration file.

[donenv](https://github.com/motdotla/dotenv) or its clones might come it handy to manage environment variables.

#### Circle CI

We use [Circle CI](https://circleci.com/) for continuous integration and continuous deployment, but you should be safe with any good CI service or server.

You can find a sample Circle CI config in `circleci-config-example.yml`. Place it into `.circleci/config.yml` and enable Circle CI for your repository.

### Creating a zone

Let's say you want to create a zone called `zone`.

#### Configuration files

First, we'll need an address book—something that maps users' short extension numbers to their "real", mobile phone numbers for forwarding. The `address_book.json` is shared between all zones, check out the sample file.

Now we'll jump to the configuration. Start with creating—or modifying—configuration files: `zone-schedule.json` and `zone-config.json.erb` in the project root. Be sure to check all fields and read inline documentation.

Next, we need to deploy the zone. Add the task to `tasks/deploy.rake`:

```ruby
  task :zone do
    deploy.call { write_production_bundle('zone') }
  end
```

Also, add this task to the `all` task right below that line:

```ruby
  desc 'Deploy all'
  task all: [
    :zone
  ]
```

#### Audio clips and sound effects

The application works best with audio clips supplied.

Check the `examples` folder for more info. There are two kinds of sounds—audio clips (see `clips/en`) and sound effects (see `clips/sfx`).

VoxImplant is designed to play remote MP3 files that are accessible over HTTP. Do use audio clips on production, record your own, place them into two folders that are accessible over HTTP, and configure your zone accordingly (see the `baseMsgClipUrl` and `baseSfxClipUrl` keys.)

**N.B.:** _Please_ don't use the supplied files in production—they are there as a placeholder. Record your own; it's easy!

**Audio clips** are played to the caller (and to the manager) when a particular event happens:

`begin.mp3`—Short greeting, announcing extension numbers

`redirect.mp3`—This is what a manager hears when they get a call to a company number

`redirect_person.mp3`—When a manager gets a redirected call via the extension number, or another manager redirects to him specifically

`redirect_conference.mp3`—When a manager gets summoned to a conference call

`incorrect_person.mp3`—When an extension number was dialed in but was incorrect

`end.mp3`—Sorry, announcing voicemail

`end_person.mp3`—Sorry, personal call (extension number), announcing voicemail

**Sound effects** are used to indicate an event to a user and are mostly used during conference calls.

`connected.mp3`—a person joined the conference call

`error.mp3`—there was an error summoning another person to a conference call

`disconnected.mp3`—a person left the conference call


#### Deployment

Next, let's check the configuration (or run continuous integration right away). Push your code or run

```
bundle exec rake deploy:all
```

manually. If you don't see any errors, you can continue.

#### Setting up VoxImplant

Next, let's visit the VoxImplant admin interface. Visit `Scenarios` and make sure that you have the `zone-bundle` scenario in the `Shared` folder.

Finally, we need to connect our compiled scenario to a phone number.

- Visit `Routing`, add `New rule`.
- Input a rule name, for instance, `Zone`.
- Choose the bundle `zone-bundle`.
- Save the rule.
- Next, visit `Numbers`
- Choose a previously bought number in `Attached` and edit it. If needed, attach it first from the `Available` list.
- Choose the `Zone` rule and save it.

All should be good! The scenario should be working now when you call your phone number. And if you've set up your CI, every time you commit to master or merge a pull request, every single configuration change (schedule, address book, application) should be applied automatically.

## Credits

- [Anton Lee](https://github.com/antoshalee/), development
- [Vladimir Kochnev](https://github.com/marshall-lee/), development
- [Tanira Wiggins](https://github.com/TaniraWrites), voice
- [Yaroslav Markin](https://github.com/yaroslav), production and idea

## License

GNU GENERAL PUBLIC LICENSE version 3 (see `LICENSE`).

Portions (sound effects at `examples/sfx` for demonstration purposes) are by https://arnofaure.github.io/free-sfx/ and are licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
