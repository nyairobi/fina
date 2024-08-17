import { promisify } from 'util';
import { addMinutes, format, formatDistance } from 'date-fns';

export class TimeTools {
    private static _startTime: Date = new Date();

    public static get launchTime() {
        return TimeTools._startTime;
    }

    private static utc(date: Date) {
        return addMinutes(date, date.getTimezoneOffset());
    }

    public static timestamp(date: Date, options?: { durationOnly: boolean }) {
        let res = `(${formatDistance(date, Date.now(), {
            addSuffix: true
        })})`;
        if (!options?.durationOnly) {
            res = `${format(TimeTools.utc(date), 'yyyy-MM-dd HH:mm')} UTC\n${res}`;
        }
        return res;
    }

    public static async wait(time: number) {
        const promise = promisify(setTimeout);
        await promise(time);
    }
}
