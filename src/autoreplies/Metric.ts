import { Message } from 'discord.js';
import { UnitConverter } from 'util/UnitConverter';

export const metric = {
    description: 'Converts some common US customary units to metric',
    pingReply: true,
    keys: ['ninja.nairobi.auto.metric'],
    process: (message: Message) => {
        const results = UnitConverter.convert(message.content);
        if (results.length > 0) {
            let res = '';
            for (const [imperial, metric] of results) {
                res += `${imperial} is ${metric}\n`;
            }
            return res;
        } else {
            return undefined;
        }
    }
};
