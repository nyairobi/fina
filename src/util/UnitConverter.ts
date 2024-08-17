/**
 * Produces a multiplying lambda with the first value predefined
 * @param firstValue x
 * @returns y => x * y
 */
const multiply = (firstValue: number) => (secondValue: number) =>
    firstValue * secondValue;

/**
 * Special function for degF -> degC conversion
 * @param fahrenheit The value in degF
 * @returns The value in degC
 */
const fahrenheitToCelsius = (fahrenheit: number) => (fahrenheit - 32.0) / 1.8;

interface Definition {
    fn: (n: number) => number;
    metricName: string;
    imperialName: string;
    separator: boolean;
    allowNonPositive?: boolean;
}

const DEFINITIONS: { [key: string]: Definition } = {
    'mi(?:les?)?': {
        fn: multiply(1.609344),
        metricName: 'km',
        imperialName: 'mi',
        separator: true
    },
    'yards?|yd': {
        fn: multiply(0.9144),
        metricName: 'm',
        imperialName: 'yd',
        separator: true
    },
    'foots?|feets?|ft': {
        fn: multiply(0.3048),
        metricName: 'm',
        imperialName: 'ft',
        separator: true
    },
    'in(?:ch(?:es)?)?': {
        fn: multiply(2.54),
        metricName: 'cm',
        imperialName: 'in',
        separator: true
    },
    'lbs?|pounds': {
        fn: multiply(0.45359237),
        metricName: 'kg',
        imperialName: 'lb',
        separator: true
    },
    '(?:deg|°)?f|(?:degrees\\s)?fahrenheits?': {
        fn: fahrenheitToCelsius,
        metricName: '°C',
        imperialName: '°F',
        separator: false,
        allowNonPositive: true
    }
};

export class UnitConverter {
    /**
     * Unique regexes for words like 21", 2', 5'11, 5'11"
     * @param text The text to search
     * @returns The response with converted values (if any)
     */
    public static convertHeight = (text: string) => {
        const regExp =
            /(?:(?<=^|\s|,|\.|:|;)(?:(?:[1-9][0-9]*')(?:(?:[1-9][0-9]*)"?)?)(?=\s|,|\.|:|;|$))|(?:(?<=^|\s|,|\.|:|;)(?:[1-9][0-9]*")(?=\s|,|\.|:|;|$))/gimu;
        const matches = text.matchAll(regExp);
        const res: [string, string][] = [];
        for (const [match] of matches) {
            let [feet, inches] = [NaN, NaN];
            let cm = 0;
            if (match.includes("'")) {
                [feet, inches] = match.split("'").map((s) => parseInt(s));
            } else {
                inches = parseInt(match);
            }
            let unit = '';
            if (!isNaN(feet)) {
                cm = feet * 30.48;
                unit += `${feet}'`;
            }
            if (!isNaN(inches)) {
                cm += inches * 2.54;
                unit += `${inches}"`;
            }
            if (cm > 0) {
                res.push([unit, `${cm.toFixed(2)} cm`]);
            }
        }
        return res;
    };

    /**
     * Regexes from the DEFINITIONS constant above
     * @param text The text to search
     * @param imperialUnit The definition key
     * @returns The response with converted values (if any)
     */
    private static convertUnit(text: string, imperialUnit: string) {
        const regExp = new RegExp(
            `(?<=[\\s|,|:|;]|^)-?(?:(?:[1-9][0-9',\\t ]*\\.|0?\\.|[1-9])[0-9',\\t ]*|0[\\t ]*)(?:${imperialUnit})\\b`,
            'giu'
        );
        const matches = text.matchAll(regExp);
        const res: [string, string][] = [];
        for (const [match] of matches) {
            const value = parseFloat(match.replace(/\s+/gu, ''));
            const definition = DEFINITIONS[imperialUnit];
            if (!isNaN(value) && (definition.allowNonPositive || value > 0)) {
                const sep = definition.separator ? ' ' : '';
                res.push([
                    `${value}${sep}${definition.imperialName}`,
                    `${definition.fn(value).toFixed(2)}${sep}${definition.metricName}`
                ]);
            }
        }
        return res;
    }

    public static convert(text: string) {
        const res = this.convertHeight(text);
        for (const imperialUnit of Object.keys(DEFINITIONS)) {
            res.push(...this.convertUnit(text, imperialUnit));
        }
        return res.slice(0, 9);
    }

    public static listUnits() {
        return Object.values(DEFINITIONS)
            .map((definition) => definition.imperialName)
            .reduce((previous, current) => `${previous}, ${current}`);
    }
}
