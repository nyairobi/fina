import fs from 'fs';
import chalk from 'chalk';
import 'dotenv/config';

export class Logger {
    private static _instance = new Logger();

    private _errFile: fs.promises.FileHandle | undefined;
    private _logFile: fs.promises.FileHandle | undefined;
    private _logToFiles: boolean;
    private _logLevel: number;

    private constructor() {
        const time = new Date().toISOString();
        this._logToFiles =
            process.env.LOG_TO_FILE === '1' || process.env.LOG_TO_FILE === undefined;
        this._logLevel = parseInt(process.env.LOG_LEVEL ?? '1');
        if (this._logToFiles) {
            fs.promises.open(`log/${time}.log`, 'w').then((file) => {
                console.log(`LogFile open: log/${time}.log`);
                this._logFile = file;
            });
            fs.promises.open(`log/${time}.err.log`, 'w').then((file) => {
                console.log(`ErrFile open: log/${time}.err.log`);
                this._errFile = file;
            });
        }
    }

    private log(
        m: unknown,
        logLevel: number,
        chalk: chalk.Chalk,
        title: string,
        isError: boolean
    ) {
        const date = chalk.dim`[${new Date().toISOString()}]`;
        let logMessage = '';
        let errorMessage = '';

        if (
            this._logToFiles &&
            (this._errFile === undefined || this._logFile === undefined)
        ) {
            setTimeout(() => this.log(m, logLevel, chalk, title, isError), 100);
            return;
        }
        if (this._logLevel >= logLevel) {
            if (isError) {
                errorMessage = `${date} ${chalk(`[${title}]`.padEnd(7))} `;
                if (m instanceof Error) {
                    errorMessage += m.stack;
                } else if (m instanceof Object) {
                    errorMessage += m.toString();
                } else {
                    errorMessage += m;
                }
            } else {
                logMessage = `${date} ${chalk(`[${title}]`.padEnd(7))} ${m}`;
            }
        }
        if (this._logToFiles) {
            if (logMessage) {
                this._logFile!.write(`${logMessage}\n`);
            }
            if (errorMessage) {
                this._errFile!.write(`${errorMessage}\n`);
            }
        } else {
            if (logMessage) {
                console.log(logMessage);
            }
            if (errorMessage) {
                console.log(errorMessage);
            }
            return;
        }
    }

    public static debugError(m: unknown) {
        Logger._instance.log(m, 3, chalk.bgRed.bold, 'Error', true);
    }

    public static debug(m: unknown) {
        Logger._instance.log(m, 3, chalk.cyan, 'Debug', false);
    }

    public static info(m: unknown) {
        Logger._instance.log(m, 2, chalk.magenta.bold, 'Info', false);
    }

    public static warn(m: unknown) {
        Logger._instance.log(m, 1, chalk.yellow.bold, 'Warn', false);
    }

    public static error(m: unknown) {
        Logger._instance.log(m, 0, chalk.bgRed.bold, 'Error', true);
    }
}
