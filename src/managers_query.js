run.define('managers_query', ['AddressBook', 'Schedule'],
  (AddressBook, Schedule) => {

class ManagersQuery {
    // All from Address Book
    static all() { 
        return AddressBook
    }

    // All managers registered in schedule
    static scheduled() {
        return this.mapScheduleToManagers(Schedule)
    }

    static byExt(ext) {
        return this.all().find(m => m.ext === ext)
    }

    // All with schedule and available on specific time
    static availableOn(time) {
        return this.mapScheduleToManagers(Schedule.filter(x => this.isAvailableOn(x, time)))
    }

    static first() {
        return this.all()[0]
    }

    static mapScheduleToManagers(schedule) {
        return schedule.map(x => AddressBook.find(m => m.email === x.email)).filter(x => x)
    }

    static isAvailableOn(x, time) {
        if (!x.schedule) { return false; }

        let weekday = time.toLocaleString('en-US', { weekday: 'short', timeZone: x.timeZone });

        let range = x.schedule.hasOwnProperty(weekday) ? x.schedule[weekday] : x.schedule['All'];
        
        if (!range) { return false; }

        let hour = parseInt(
            time.toLocaleString('en-US', { hour: '2-digit', hour12: false, timeZone: x.timeZone })
        );

        return (range[0] <= hour && hour < range[1]);
    }
}

class ManagersPool {
    constructor(managers) {
        this.managers = managers;
        this.reset();
    }

    reset() {
        this.currentIdx = 0;
    }

    next() {
        return this.managers[this.currentIdx++];
    }

    isEmpty() {
        return this.length === 0;
    }

    get length() {
        return this.managers.length
    }
}

return { ManagersQuery, ManagersPool };
}); // run.define