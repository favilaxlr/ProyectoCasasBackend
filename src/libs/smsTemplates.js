const BRAND_PREFIX = 'FRFI ';
const OPT_OUT_TAG = ' STOP=stop HELP=help';
const DEFAULT_LIMIT = 160;

const normalizeText = (value = '') => value.toString().replace(/\s+/g, ' ').trim();

export const shorten = (value = '', max = 20) => {
    const text = normalizeText(value);
    if (!text) return '';
    if (text.length <= max) return text;
    if (max <= 3) return '...';
    return `${text.slice(0, max - 3)}...`;
};

export const buildSMS = (payload, limit = DEFAULT_LIMIT) => {
    const cleanPayload = normalizeText(payload);
    const available = Math.max(5, limit - BRAND_PREFIX.length - OPT_OUT_TAG.length);
    const core = shorten(cleanPayload, available);
    return `${BRAND_PREFIX}${core}${OPT_OUT_TAG}`;
};

export const formatShortDate = (input) => {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '';
    const month = (date.getMonth() + 1).toString();
    const day = date.getDate().toString();
    return `${month}/${day}`;
};

export const formatTimeLabel = (time) => {
    if (!time) return '';
    const [hourStr = '0', minuteStr = '00'] = time.split(':');
    let hour = Number(hourStr);
    if (Number.isNaN(hour)) return shorten(time, 5);
    const suffix = hour >= 12 ? 'p' : 'a';
    hour = hour % 12 || 12;
    const minutes = minuteStr.padStart(2, '0');
    return `${hour}:${minutes}${suffix}`;
};
