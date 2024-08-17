import { Fina } from 'core/Fina';
import { Logger } from 'core/Logger';

new Fina();

process.on('unhandledRejection', (error) => {
    Logger.error(error);
});

process.on('uncaughtException', (error) => {
    Logger.error('Uncaught exception');
    Logger.error(error);
    process.exit(-1);
});
